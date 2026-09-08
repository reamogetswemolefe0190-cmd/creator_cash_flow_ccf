import subprocess
import time
import json
import socket
import base64
import os
import re
import struct
import tempfile

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

class RawWebSocket:
    def __init__(self, url):
        # url: ws://127.0.0.1:PORT/devtools/browser/GUID or /page/GUID
        url_clean = url.replace("ws://", "")
        host_port, path = url_clean.split("/", 1)
        host, port = host_port.split(":")
        self.host = host
        self.port = int(port)
        self.path = "/" + path
        self.sock = None

    def connect(self):
        self.sock = socket.create_connection((self.host, self.port), timeout=10)
        sec_key = base64.b64encode(os.urandom(16)).decode('utf-8')
        headers = [
            f"GET {self.path} HTTP/1.1",
            f"Host: {self.host}:{self.port}",
            "Upgrade: websocket",
            "Connection: Upgrade",
            f"Sec-WebSocket-Key: {sec_key}",
            "Sec-WebSocket-Version: 13",
            "\r\n"
        ]
        self.sock.sendall("\r\n".join(headers).encode('utf-8'))
        response = self.sock.recv(4096).decode('utf-8', errors='ignore')
        if "101" not in response:
            raise Exception(f"WebSocket handshake failed: {response}")

    def send_frame(self, data_str):
        data = data_str.encode('utf-8')
        length = len(data)
        mask_key = os.urandom(4)
        
        header = bytearray()
        header.append(0x81) # text frame, fin
        
        if length <= 125:
            header.append(0x80 | length)
        elif length <= 65535:
            header.append(0x80 | 126)
            header.extend(struct.pack("!H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack("!Q", length))
            
        header.extend(mask_key)
        
        masked_data = bytearray(length)
        for i in range(length):
            masked_data[i] = data[i] ^ mask_key[i % 4]
            
        self.sock.sendall(header + masked_data)

    def recv_frame(self):
        def recv_exact(n):
            buf = bytearray()
            while len(buf) < n:
                chunk = self.sock.recv(n - len(buf))
                if not chunk:
                    raise Exception("Socket closed")
                buf.extend(chunk)
            return buf

        b1, b2 = recv_exact(2)
        fin = (b1 & 0x80) != 0
        opcode = b1 & 0x0F
        has_mask = (b2 & 0x80) != 0
        length = b2 & 0x7F

        if length == 126:
            length = struct.unpack("!H", recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", recv_exact(8))[0]

        mask = None
        if has_mask:
            mask = recv_exact(4)

        payload = recv_exact(length)
        if has_mask:
            unmasked = bytearray(length)
            for i in range(length):
                unmasked[i] = payload[i] ^ mask[i % 4]
            payload = unmasked

        return payload.decode('utf-8', errors='ignore')

    def close(self):
        if self.sock:
            self.sock.close()

class CdpSession:
    def __init__(self, ws_url):
        self.ws = RawWebSocket(ws_url)
        self.msg_id = 1
        self.target_id = None
        self.session_id = None

    def connect(self):
        self.ws.connect()

    def call(self, method, params=None, session_id=None):
        mid = self.msg_id
        self.msg_id += 1
        payload = {"id": mid, "method": method, "params": params or {}}
        if session_id:
            payload["sessionId"] = session_id
        self.ws.send_frame(json.dumps(payload))
        
        while True:
            raw = self.ws.recv_frame()
            data = json.loads(raw)
            if data.get("id") == mid:
                if "error" in data:
                    raise Exception(f"CDP error: {data['error']}")
                return data.get("result", {})

    def create_page_session(self, url):
        # Create new target
        res = self.call("Target.createTarget", {"url": url})
        self.target_id = res["targetId"]
        # Attach to target
        attach_res = self.call("Target.attachToTarget", {"targetId": self.target_id, "flatten": True})
        self.session_id = attach_res["sessionId"]
        return self.session_id

    def evaluate(self, expr):
        res = self.call("Runtime.evaluate", {"expression": expr, "returnByValue": True}, session_id=self.session_id)
        return res.get("result", {}).get("value")

    def close(self):
        self.ws.close()

def main():
    tmp_dir = tempfile.mkdtemp(prefix="chrome_cdp_challenger_")
    print(f"Launching Chrome with isolated profile: {tmp_dir}")
    
    proc = subprocess.Popen([
        CHROME_PATH,
        f"--user-data-dir={tmp_dir}",
        "--remote-debugging-port=0",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--remote-allow-origins=*"
    ], stderr=subprocess.PIPE, stdout=subprocess.PIPE)

    ws_url = None
    start_time = time.time()
    while time.time() - start_time < 10:
        line = proc.stderr.readline().decode('utf-8', errors='ignore')
        if not line and proc.poll() is not None:
            break
        match = re.search(r'DevTools listening on (ws://[^\s]+)', line)
        if match:
            ws_url = match.group(1).strip()
            break

    if not ws_url:
        print("Failed to capture WebSocket URL from Chrome stderr!")
        proc.terminate()
        return

    print(f"Captured Browser WS URL: {ws_url}")

    session = CdpSession(ws_url)
    session.connect()
    session_id = session.create_page_session("http://localhost:3000")

    session.call("Page.enable", session_id=session_id)
    session.call("Runtime.enable", session_id=session_id)

    viewports = [
        {"name": "iPhone SE", "width": 375, "height": 667, "mobile": True, "scale": 2},
        {"name": "iPhone 14", "width": 390, "height": 844, "mobile": True, "scale": 3},
        {"name": "iPhone 14 Pro Max", "width": 430, "height": 932, "mobile": True, "scale": 3},
        {"name": "Desktop 1440p", "width": 1440, "height": 900, "mobile": False, "scale": 1}
    ]

    full_results = {
        "viewports": {},
        "interactions": {},
        "cssChecks": {},
        "verdict": None
    }

    for vp in viewports:
        print(f"\n--- Testing Viewport: {vp['name']} ({vp['width']}x{vp['height']}) ---")
        session.call("Emulation.setDeviceMetricsOverride", {
            "width": vp['width'],
            "height": vp['height'],
            "deviceScaleFactor": vp['scale'],
            "mobile": vp['mobile']
        }, session_id=session_id)
        
        session.call("Page.navigate", {"url": "http://localhost:3000"}, session_id=session_id)
        time.sleep(1.5)

        script = """
        (() => {
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const docEl = document.documentElement;
            const body = document.body;
            const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
            const hasOverflow = scrollW > winW + 1;

            // Elements extending past viewport right edge
            const overflowEls = [];
            document.querySelectorAll('*').forEach(el => {
                const r = el.getBoundingClientRect();
                const style = getComputedStyle(el);
                if (r.right > winW + 2 && r.width > 0) {
                    const isWrapper = el.classList.contains('ambient-mesh-wrapper');
                    if (!isWrapper && style.overflow !== 'hidden' && style.position !== 'fixed') {
                        overflowEls.push({
                            tag: el.tagName,
                            id: el.id,
                            class: el.className,
                            right: Math.round(r.right),
                            width: Math.round(r.width),
                            winW: winW
                        });
                    }
                }
            });

            // Glass Pill Nav check
            const nav = document.querySelector('.glass-pill-nav');
            let navData = null;
            if (nav) {
                const r = nav.getBoundingClientRect();
                const s = getComputedStyle(nav);
                navData = {
                    width: Math.round(r.width),
                    left: Math.round(r.left),
                    right: Math.round(r.right),
                    centered: Math.abs((r.left + r.width/2) - (winW/2)) < 5,
                    backdropFilter: s.backdropFilter || s.webkitBackdropFilter,
                    borderRadius: s.borderRadius
                };
            }

            // Arc Hero Mockup check
            const arcFrame = document.getElementById('arc-browser-frame');
            let arcData = null;
            if (arcFrame) {
                const r = arcFrame.getBoundingClientRect();
                const badgeTR = document.querySelector('.badge-top-right')?.getBoundingClientRect();
                const badgeBL = document.querySelector('.badge-bottom-left')?.getBoundingClientRect();
                arcData = {
                    width: Math.round(r.width),
                    left: Math.round(r.left),
                    right: Math.round(r.right),
                    badgeTRClipped: badgeTR ? (badgeTR.right > winW || badgeTR.left < 0) : null,
                    badgeBLClipped: badgeBL ? (badgeBL.right > winW || badgeBL.left < 0) : null,
                    badgeTRRight: badgeTR ? Math.round(badgeTR.right) : null,
                    badgeBLLeft: badgeBL ? Math.round(badgeBL.left) : null
                };
            }

            // Ambient mesh check
            const mesh = document.querySelector('.ambient-mesh-wrapper');
            let meshData = null;
            if (mesh) {
                const r = mesh.getBoundingClientRect();
                const s = getComputedStyle(mesh);
                meshData = {
                    width: Math.round(r.width),
                    height: Math.round(r.height),
                    overflow: s.overflow,
                    orbsCount: mesh.querySelectorAll('.ambient-orb').length
                };
            }

            return {
                winW,
                winH,
                scrollW,
                hasOverflow,
                overflowElsCount: overflowEls.length,
                overflowEls: overflowEls.slice(0, 5),
                navData,
                arcData,
                meshData
            };
        })()
        """
        vp_res = session.evaluate(script)
        full_results["viewports"][vp["name"]] = vp_res

    # Desktop Interactions
    print("\n--- Testing Desktop Interactions ---")
    session.call("Emulation.setDeviceMetricsOverride", {
        "width": 1440,
        "height": 900,
        "deviceScaleFactor": 1,
        "mobile": False
    }, session_id=session_id)
    session.call("Page.navigate", {"url": "http://localhost:3000"}, session_id=session_id)
    time.sleep(1.0)

    interact_script = """
    (() => {
        const steps = [];

        // Initial balance
        const b1 = document.getElementById('hero-mockup-balance-display')?.innerText;
        steps.push({ name: 'Initial Balance', val: b1, pass: b1 === 'R24,650' });

        // Toggle Annual
        setHeroMockupPeriod('annual');
        const b2 = document.getElementById('hero-mockup-balance-display')?.innerText;
        const line2 = document.getElementById('hero-chart-line')?.getAttribute('d');
        steps.push({ name: 'Annual Balance Toggle', val: b2, pass: b2 === 'R295,800' });

        // Toggle Monthly back
        setHeroMockupPeriod('monthly');
        const b3 = document.getElementById('hero-mockup-balance-display')?.innerText;
        steps.push({ name: 'Monthly Balance Toggle Back', val: b3, pass: b3 === 'R24,650' });

        // Tab switching
        switchHeroMockupTab('revenue');
        const t1 = document.getElementById('hero-mockup-tab-title')?.innerText;
        steps.push({ name: 'Switch Tab Revenue', val: t1, pass: t1 === 'Consolidated Revenue Streams' });

        switchHeroMockupTab('tax');
        const t2 = document.getElementById('hero-mockup-tab-title')?.innerText;
        steps.push({ name: 'Switch Tab Tax', val: t2, pass: t2 === 'Tax Deduction & Savings Engine' });

        switchHeroMockupTab('overview');
        const t3 = document.getElementById('hero-mockup-tab-title')?.innerText;
        steps.push({ name: 'Switch Tab Overview', val: t3, pass: t3 === 'Creator Cash Flow Command Center' });

        // Sidebar toggle
        const sb = document.getElementById('arc-sidebar-preview');
        const initH = sb.classList.contains('hidden');
        toggleArcSidebar();
        const afterH = sb.classList.contains('hidden');
        toggleArcSidebar();
        steps.push({ name: 'Sidebar Toggle', initHidden: initH, afterHidden: afterH, pass: initH !== afterH });

        return steps;
    })()
    """
    full_results["interactions"] = session.evaluate(interact_script)

    # CSS checks
    css_script = """
    (() => {
        const stylesheets = Array.from(document.styleSheets);
        const keyframes = [];
        stylesheets.forEach(ss => {
            try {
                Array.from(ss.cssRules || []).forEach(r => {
                    if (r.type === CSSRule.KEYFRAMES_RULE) {
                        keyframes.push(r.name);
                    }
                });
            } catch(e) {}
        });

        const expectedKeyframes = ['floatEmerald', 'floatTeal', 'floatIndigo', 'pulseCenterCore', 'fadeSlideUp', 'floatBadge', 'floatBadgeDelayed'];
        const keyframesFound = expectedKeyframes.map(k => ({ name: k, found: keyframes.includes(k) }));

        return {
            totalKeyframes: keyframes.length,
            keyframesFound,
            hasEmeraldOrb: !!document.querySelector('.ambient-orb-emerald'),
            hasTealOrb: !!document.querySelector('.ambient-orb-teal'),
            hasIndigoOrb: !!document.querySelector('.ambient-orb-indigo'),
            hasCenterGlow: !!document.querySelector('.ambient-mesh-center-glow')
        };
    })()
    """
    full_results["cssChecks"] = session.evaluate(css_script)

    session.close()
    proc.terminate()

    with open(r"c:\Users\User\OneDrive\Desktop\New folder (2)\.agents\teamwork_preview_challenger_m1_1\empirical_results.json", "w") as f:
        json.dump(full_results, f, indent=2)

    print("\n=== EMPIRICAL VERIFICATION COMPLETE ===")
    print(json.dumps(full_results, indent=2))

if __name__ == '__main__':
    main()
