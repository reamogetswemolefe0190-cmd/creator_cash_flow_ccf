import sys
import glob

def fix_all_arrows():
    svg_arrow = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px; vertical-align: -2px; display: inline-block;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>'
    
    files = glob.glob("*.html") + glob.glob("*.js")
    
    for filepath in files:
        if filepath == "fix.py" or filepath == "fix2.py": continue
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            content = content.replace('→', svg_arrow)
            content = content.replace('â†’', svg_arrow)
            content = content.replace('&rarr;', svg_arrow)
            content = content.replace('➔', svg_arrow)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
                
            print(f"Cleaned arrows in {filepath}")
        except Exception as e:
            print(f"Error on {filepath}: {e}")

fix_all_arrows()
