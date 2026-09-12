const state = {
            page: 'landing',
            step: 0,
            activeWorkspaceTab: 'Overview',
            chatMessages: {
                creator: [
                    { sender: 'Studio North (Nadia)', time: '10:24 AM', text: 'Hey Thando! The brand approved the outdoor movement concept. Please keep the opening shot natural and feature the bottle in the first 3 seconds.', incoming: true },
                    { sender: 'Thando Mokoena', time: '10:45 AM', text: 'Thanks Nadia! Filming tomorrow morning at Camps Bay. Will upload the draft link by Monday 16 Sep.', incoming: false },
                    { sender: 'Studio North (Nadia)', time: '11:02 AM', text: 'Perfect! Once uploaded, our team will run a quick QC before handing over to Vela Active for publishing approval.', incoming: true }
                ],
                agency: [
                    { sender: 'Vela Active (Sarah)', time: '09:15 AM', text: 'Good morning Studio North team. Budget allocation for Spring in motion is locked at R60,000. Looking forward to reviewing Thando and Naledi’s drafts.', incoming: true },
                    { sender: 'Studio North Lead', time: '09:30 AM', text: 'Thanks Sarah. Thando’s video is filming tomorrow and Naledi’s stories are already drafted. Will push for your sign-off by 18 Sep.', incoming: false }
                ],
                brand: [
                    { sender: 'Studio North (Lead)', time: '09:30 AM', text: 'Hi Sarah, 8 of the 12 deliverables have been checked and approved by our team. Thando’s video is scheduled next.', incoming: true },
                    { sender: 'Vela Active Brand', time: '09:48 AM', text: 'Great progress. Please ensure the link clicks are tracked with the #CCF-024 campaign UTMs.', incoming: false }
                ]
            }
        };

        const stages = [
            [
                'Brand',
                'Create the brief',
                'Set the budget, deliverables, usage rights and deadline.',
                'Publish campaign brief',
                'Agency receives a campaign invitation.',
                'R60,000 campaign budget'
            ],
            [
                'Agency',
                'Build the creator team',
                'Match the brief to the roster and agree each creator’s fee.',
                'Send creator invitation',
                'Creator receives the scope, dates and offer.',
                'R12,000 creator offer'
            ],
            [
                'Creator',
                'Accept and create',
                'Accept the offer, then submit the first video for review.',
                'Submit deliverable',
                'Agency receives the draft and creator notes.',
                '1 video · 3 stories'
            ],
            [
                'Agency',
                'Review the content',
                'Check the work against the brief before sending it to the brand.',
                'Send to brand',
                'Brand receives the checked version for final approval.',
                'Version 1 · ready for review'
            ],
            [
                'Brand',
                'Approve for publishing',
                'Approve the content or request a revision in the same thread.',
                'Approve deliverable',
                'Creator receives approval and the publishing schedule.',
                'Approved · publish 18 Sep'
            ],
            [
                'Creator',
                'Track payment',
                'Upload the live link and invoice; agency confirms the payment status.',
                'Mark invoice as sent',
                'Brand and agency see the invoice; creator sees the due date.',
                'R12,000 · due 30 Sep'
            ]
        ];

        function getPhotoHtml(key) {
            const template = document.getElementById('cc-photo-assets');
            if (!template) return '';
            const img = template.content.querySelector('[data-stock="' + key + '"]');
            return img ? img.outerHTML : '';
        }

        function setPage(pageName, updateHash = true) {
            state.page = pageName;
            
            // Sync Floating Dock Active State
            document.querySelectorAll('.cc-dock-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.dockPage === pageName);
            });

            if (updateHash) {
                window.location.hash = pageName;
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
            render();
        }

        function setStep(stepIndex) {
            state.step = stepIndex;
            render();
        }

        function nextStep() {
            state.step = (state.step + 1) % 6;
            render();
        }

        function setWorkspaceTab(tabName) {
            state.activeWorkspaceTab = tabName;
            render();
        }

        function openCampaignFlow(currentRole) {
            if (currentRole === 'creator') state.step = 2; // Accept and create
            else if (currentRole === 'agency') state.step = 3; // Review the content
            else if (currentRole === 'brand') state.step = 4; // Approve for publishing
            setPage('journey');
        }

        function openTourDock() {
            const dock = document.getElementById('cc-tour-dock');
            if (dock) {
                dock.scrollIntoView({ behavior: 'smooth' });
                dock.style.boxShadow = '0 0 0 3px #D4F973, 0 20px 48px rgba(0,0,0,0.8)';
                setTimeout(() => {
                    dock.style.boxShadow = '';
                }, 1200);
            }
        }

        function renderRow(title, sub, tag, tagClass = '') {
            return `
                <div class="cc-row">
                    <div>
                        <strong>${title}</strong>
                        <span class="cc-small">${sub}</span>
                    </div>
                    <span class="cc-tag ${tagClass}">${tag}</span>
                </div>
            `;
        }

        function sendChatMessage(role) {
            const input = document.getElementById('chat-input-field');
            if (!input || !input.value.trim()) return;

            const text = input.value.trim();
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const myName = role === 'creator' ? 'Thando Mokoena' : role === 'agency' ? 'Studio North Lead' : 'Vela Active Brand';

            state.chatMessages[role].push({
                sender: myName,
                time: timeStr,
                text: text,
                incoming: false
            });

            input.value = '';
            render();
        }

        function approveBrandDeliverable(creatorName) {
            alert('Deliverable for ' + creatorName + ' successfully approved! Publishing schedule confirmed for 18 Sep.');
            render();
        }

        function downloadInvoiceProof(invNumber) {
            alert('Downloading certified PDF receipt for ' + invNumber + ' (POPIA-compliant SARS sole-proprietor record).');
        }

        function render() {
            const viewport = document.getElementById('cc-screen');
            if (!viewport) return;

            if (state.page === 'landing') {
                viewport.innerHTML = `
                    <!-- Hero Section -->
                    <section class="ce-hero ce-hero-v2 reveal-on-scroll">
                        <div class="ce-hero-copy reveal-on-scroll reveal-delay-1">
                            <h1>Great campaigns.<br><em>Clearly connected.</em></h1>
                            <p>Briefs, creators, performance and payment milestones moving together in one beautifully simple workspace.</p>
                            <div class="cc-actions">
                                <button class="cc-btn cc-primary" data-command="setPage('signup')">Start as a creator ↗</button>
                                <button class="cc-btn" data-command="setPage('journey')">Watch the workflow</button>
                            </div>
                        </div>
                        <div class="ce-product-stage" aria-label="Animated campaign workspace preview">
                            <div class="ce-stage-orbit"></div>
                            <article class="ce-stage-main">
                                <div class="ce-stage-top"><span>SPRING IN MOTION</span><b>LIVE</b></div>
                                <h3>One campaign.<br>Everyone in sync.</h3>
                                <div class="ce-stage-progress"><span></span></div>
                                <div class="ce-stage-people"><span>TM</span><span>SN</span><span>VA</span><small>Creator → Agency → Brand</small></div>
                            </article>
                            <article class="ce-float-card ce-float-metric"><small>VERIFIED VIEWS</small><strong>128.4K</strong><span>↑ 18.6%</span></article>
                            <article class="ce-float-card ce-float-payment"><small>MILESTONE REACHED</small><strong>R5,000</strong><span>Ready for approval →</span></article>
                            <div class="ce-signal ce-signal-one"></div><div class="ce-signal ce-signal-two"></div>
                        </div>
                    </section>

                    <!-- Showcase Collage Grid -->
                    <section class="ce-collage reveal-on-scroll">
                        <div class="ce-photo">
                            ${getPhotoHtml('creator')}
                            <div class="ce-photo-label">
                                <div>
                                    <small>MORE SPACE TO MAKE YOUR NEXT BIG THING</small>
                                    <h3>Keep creating.<br>We’ll help with the business.</h3>
                                </div>
                                <button class="ce-round" data-command="setPage('creator')" aria-label="Explore creator workspace">↗</button>
                            </div>
                        </div>

                        <div class="ce-money">
                            <div>
                                <div class="ce-money-top">
                                    <span>YOUR MONEY, AT A GLANCE</span>
                                    <span>↗</span>
                                </div>
                                <div style="font-size: 13px; margin-top: 24px; color: #36462B; font-weight: 600;">Income received · September</div>
                                <div class="ce-money-value">R38,500<span style="font-size: 18px; letter-spacing: 0; font-weight: 500;">.00</span></div>
                                <div class="ce-spark" aria-label="Illustrative six month income trend">
                                    <span style="height: 28px;" title="April: R14,000"></span>
                                    <span style="height: 42px;" title="May: R21,000"></span>
                                    <span style="height: 36px;" title="June: R18,000"></span>
                                    <span style="height: 52px;" title="July: R26,000"></span>
                                    <span style="height: 60px;" title="August: R30,000"></span>
                                    <span style="height: 72px;" title="September: R38,500"></span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 8px; color: #36462B; font-weight: 700;">
                                    <span>Apr</span>
                                    <span>Sep</span>
                                </div>
                            </div>
                            <div class="ce-money-bottom">
                                <span>Next payment<br><strong>Vela Active</strong></span>
                                <span>Due 30 Sep<br><strong>R12,000 →</strong></span>
                            </div>
                        </div>
                    </section>

                    <!-- Roles Architecture Section -->
                    <section class="ce-section-head">
                        <h2>One workflow.<br>Three clear roles.</h2>
                        <p>Creator accounts are live. Agency and brand screens below are labelled product previews.</p>
                    </section>

                    <section class="ce-roles">
                        <div class="ce-role">
                            <span class="cc-kicker">01 / CREATORS · LIVE ACCOUNT</span>
                            <h3>Your talent. Your business.</h3>
                            <p>Manage deliverables, see upcoming payments and stay on top of your income.</p>
                            <button class="cc-link" data-command="setPage('creator')">View creator demo ↗</button>
                        </div>
                        <div class="ce-role">
                            <span class="cc-kicker">02 / AGENCIES · EARLY-ACCESS PILOT</span>
                            <h3>Bring the whole team together.</h3>
                            <p>Connect your roster to the right briefs and keep every approval moving.</p>
                            <button class="cc-link" data-command="setPage('agency')">View agency preview ↗</button>
                            <a class="cc-link ce-pilot-link" href="mailto:reamogetswemolefe@creatorcashflow.co.za?subject=Agency%20pilot%20application">Apply for pilot</a>
                        </div>
                        <div class="ce-role">
                            <span class="cc-kicker">03 / BRANDS · EARLY-ACCESS PILOT</span>
                            <h3>Good ideas. Real outcomes.</h3>
                            <p>Set the brief, approve the work and understand where your budget goes.</p>
                            <button class="cc-link" data-command="setPage('brand')">View brand preview ↗</button>
                            <a class="cc-link ce-pilot-link" href="mailto:reamogetswemolefe@creatorcashflow.co.za?subject=Brand%20campaign%20enquiry">Request a campaign</a>
                        </div>
                    </section>

                    <!-- Collaborative Teamwork Section -->
                    <section class="ce-team">
                        ${getPhotoHtml('team')}
                        <div class="ce-team-copy">
                            <div class="cc-kicker" style="color: #C4D3A9;">LESS BACK AND FORTH</div>
                            <h2>Great work is<br>a team sport.</h2>
                            <p>A shared brief. Clear feedback. A visible next step. Keep creators, agencies and brands on the same page.</p>
                            <button class="cc-btn cc-primary" data-command="setPage('journey')">View sample campaign ↗</button>
                        </div>
                    </section>
                `;
            } else if (state.page === 'login') {
                viewport.innerHTML = `
                    <div class="cc-login">
                        <div class="cc-login-art">
                            ${getPhotoHtml('creator')}
                            <div>
                                <div class="cc-kicker" style="color: var(--cc-accent);">A little less admin</div>
                                <h2>Your next chapter<br>starts here.</h2>
                                <p>One account. The right workspace.<br>Every collaboration connected.</p>
                            </div>
                            <div class="cc-row" style="border: 0; padding: 0;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span class="cc-avatar" style="color: var(--cc-accent);">TM</span>
                                    <span>Thando’s workspace</span>
                                </div>
                                <span class="cc-tag">Creator ↗</span>
                            </div>
                        </div>

                        <div class="cc-login-form">
                            <div class="cc-kicker">Welcome back</div>
                            <h2>Let’s get to work.</h2>
                            <p class="cc-small">Select a demo persona. This is not an account sign-in.</p>

                            <label class="cc-field">
                                Workspace Role
                                <select id="demo-role-select" data-demo-role="true">
                                    <option value="creator">Creator · Thando Mokoena</option>
                                    <option value="agency">Agency · Studio North</option>
                                    <option value="brand">Brand · Vela Active</option>
                                </select>
                            </label>

                            <label class="cc-field">
                                Email address
                                <input type="email" id="demo-email-input" value="thando@example.com" autocomplete="off">
                            </label>

                            <label class="cc-field">
                                Password
                                <input type="password" value="••••••••••••" placeholder="Enter your password" autocomplete="off">
                            </label>

                            <button class="cc-btn cc-primary" style="width: 100%; margin-top: 10px;" data-command="executeDemoLogin()">
                                Enter demo workspace →
                            </button>

                            <div class="cc-small" style="margin-top: 18px; text-align: center;">
                                Looking for admin management? <a href="admin.html" style="color: var(--cc-accent); text-decoration: underline;">Open Admin Portal</a>
                            </div>
                        </div>
                    </div>
                `;
            } else if (['creator', 'agency', 'brand'].includes(state.page)) {
                const role = state.page;
                const isCreator = role === 'creator';
                const isAgency = role === 'agency';
                const isBrand = role === 'brand';

                const roleLabel = isCreator ? 'Creator' : isAgency ? 'Agency' : 'Brand';
                const roleName = isCreator ? 'Thando' : isAgency ? 'Studio North' : 'Vela Active';
                const roleAvatar = isCreator ? 'TM' : isAgency ? 'SN' : 'VA';

                const metrics = isCreator ? [
                    ['Received this month', 'R38,500', 'Across 4 payments'],
                    ['Awaiting payment', 'R18,000', '2 invoices outstanding'],
                    ['Active campaigns', '3', '1 action needs you']
                ] : isAgency ? [
                    ['Active campaigns', '8', 'Across 4 brand clients'],
                    ['Creators on roster', '24', '6 on active briefs'],
                    ['Awaiting review', '5', '2 due this week']
                ] : [
                    ['Campaign budget', 'R60,000', 'Spring in motion'],
                    ['Committed spend', 'R42,000', 'R18,000 unallocated'],
                    ['Deliverables approved', '8 / 12', '4 still in review']
                ];

                // Sub-view rendering based on state.activeWorkspaceTab
                let subViewContent = '';

                if (state.activeWorkspaceTab === 'Overview') {
                    subViewContent = `
                        <div class="cc-metrics">
                            ${metrics.map(m => `
                                <div class="cc-metric">
                                    <div>
                                        <div class="cc-small">${m[0]}</div>
                                        <div class="cc-num">${m[1]}</div>
                                    </div>
                                    <span class="cc-small">${m[2]}</span>
                                </div>
                            `).join('')}
                        </div>

                        <div class="cc-columns">
                            <div>
                                <!-- Needs Attention Banner -->
                                <div class="cc-campaign-banner">
                                    ${getPhotoHtml(isCreator ? 'creator' : 'team').replace('<img ', '<img class="ce-mini-photo" ')}
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span class="cc-small" style="letter-spacing: 1px; color: #A3E635; font-weight: 700;">NEEDS YOUR ATTENTION</span>
                                        <span>↗</span>
                                    </div>
                                    <h3>Spring in motion</h3>
                                    <p class="cc-small" style="color: #C6D8CB; margin-bottom: 18px;">
                                        ${isCreator ? 'Your first video draft is due on 16 September.' : isAgency ? 'Thando’s first video is ready for your quality check.' : 'The agency has sent 2 deliverables for final approval.'}
                                    </p>
                                    <button class="cc-btn cc-primary" data-command="openCampaignFlow('${role}')">
                                        ${isCreator ? 'Open deliverables' : isAgency ? 'Review submissions' : 'Review & approve'} →
                                    </button>
                                </div>

                                <!-- Middle Box (Payments / Roster / Performance) -->
                                <div class="cc-box">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                                        <h3>${isCreator ? 'Upcoming payments' : isAgency ? 'Creator roster' : 'Campaign performance'}</h3>
                                        <button class="cc-link" data-command="setWorkspaceTab('${isCreator ? 'Income' : isAgency ? 'Roster' : 'Partners'}')">View all →</button>
                                    </div>
                                    ${isCreator ? (
                                        renderRow('Vela Active', 'Spring in motion · due 30 Sep', 'R12,000') +
                                        renderRow('Homegrown Coffee', 'Morning ritual · due 24 Sep', 'R6,000')
                                    ) : isAgency ? (
                                        renderRow('Thando Mokoena', 'Lifestyle · Spring in motion', 'Draft ready') +
                                        renderRow('Naledi Dube', 'Wellness · Spring in motion', 'Creating') +
                                        renderRow('Sipho Khumalo', 'Fitness · Weekend movement', 'Approved')
                                    ) : (
                                        renderRow('Views', 'Across 8 published deliverables', '128,400') +
                                        renderRow('Engagement rate', 'Interactions ÷ views', '4.8%') +
                                        renderRow('Link clicks', 'Tracked campaign links', '2,140')
                                    )}
                                </div>
                            </div>

                            <div>
                                <!-- Right Box: Progress Checklist & Chat Snippet -->
                                <div class="cc-box">
                                    <h3>${isCreator ? 'Your campaign checklist' : isAgency ? 'Approval queue' : 'Delivery progress'}</h3>
                                    ${renderRow('Brief & fee agreed', 'Vela Active · campaign #024', 'Done', 'cc-tag-completed')}
                                    ${renderRow('First video draft', 'Thando Mokoena · 16 Sep', isCreator ? 'Due next' : 'In review', 'cc-tag-pending')}
                                    ${renderRow('Brand approval', 'Vela Active · 18 Sep', 'Upcoming')}
                                    
                                    <div class="cc-progress">
                                        <span style="width: 40%;"></span>
                                    </div>
                                    <div class="cc-small">2 of 5 milestones complete</div>

                                    <hr style="border: 0; border-top: 1px solid var(--cc-line); margin: 22px 0;">

                                    <h3>Campaign conversation</h3>
                                    <div class="cc-small" style="display: flex; align-items: center; gap: 8px;">
                                        <span class="cc-avatar" style="width: 24px; height: 24px; font-size: 10px;">SN</span>
                                        Studio North · 10:24
                                    </div>
                                    <p style="font-size: 13px; margin: 12px 0; color: #E0E7E1; font-style: italic;">
                                        “The updated brief is ready. Please keep the opening shot outdoors.”
                                    </p>
                                    <button class="cc-link" data-command="setWorkspaceTab('Inbox')">
                                        Open conversation →
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (state.activeWorkspaceTab === 'Campaigns') {
                    subViewContent = isCreator ? `
                        <div class="cc-subnav-row">
                            <div class="cc-filter-pills">
                                <button class="cc-filter-pill active">All Campaigns (3)</button>
                                <button class="cc-filter-pill">In Production (1)</button>
                                <button class="cc-filter-pill">In Review (1)</button>
                                <button class="cc-filter-pill">Completed (12)</button>
                            </div>
                            <button class="cc-btn cc-primary cc-btn-nav" data-command="setPage('journey')">View Shared Journey Pipeline ↗</button>
                        </div>

                        <div class="cc-table-wrap">
                            <table class="cc-table">
                                <thead>
                                    <tr>
                                        <th>Campaign</th>
                                        <th>Brand & Agency</th>
                                        <th>Scope</th>
                                        <th>Payout</th>
                                        <th>Deadline</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><strong>Spring in motion</strong><br><span class="cc-small">#CCF-024</span></td>
                                        <td>Vela Active<br><span class="cc-small">via Studio North</span></td>
                                        <td>1 Video + 3 Stories</td>
                                        <td><strong style="color:#A3E635;">R12,000</strong></td>
                                        <td>16 Sep 2026</td>
                                        <td><span class="cc-tag cc-tag-pending">Draft In Progress</span></td>
                                        <td><button class="cc-btn cc-btn-nav cc-primary" data-command="setPage('journey')">Submit Draft →</button></td>
                                    </tr>
                                    <tr>
                                        <td><strong>Morning Ritual</strong><br><span class="cc-small">#CCF-019</span></td>
                                        <td>Homegrown Coffee<br><span class="cc-small">Direct Partnership</span></td>
                                        <td>2 TikTok Videos</td>
                                        <td><strong style="color:#A3E635;">R6,000</strong></td>
                                        <td>24 Sep 2026</td>
                                        <td><span class="cc-tag cc-tag-completed">Draft Approved</span></td>
                                        <td><button class="cc-btn cc-btn-nav" data-command="downloadInvoiceProof('INV-084')">View Invoice</button></td>
                                    </tr>
                                    <tr>
                                        <td><strong>Urban Movement</strong><br><span class="cc-small">#CCF-012</span></td>
                                        <td>Peak Athletics<br><span class="cc-small">via Studio North</span></td>
                                        <td>1 Reel + Photos</td>
                                        <td><strong style="color:#A3E635;">R8,500</strong></td>
                                        <td>31 Aug 2026</td>
                                        <td><span class="cc-tag cc-tag-completed">Paid ✓</span></td>
                                        <td><button class="cc-btn cc-btn-nav" data-command="downloadInvoiceProof('INV-077')">Sample receipt details</button></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ` : isAgency ? `
                        <div class="cc-subnav-row">
                            <div class="cc-filter-pills">
                                <button class="cc-filter-pill active">All Client Campaigns (8)</button>
                                <button class="cc-filter-pill">Production (3)</button>
                                <button class="cc-filter-pill">Reviewing (5)</button>
                            </div>
                            <button class="cc-btn cc-primary cc-btn-nav" data-command="setPage('journey')">Open Collaborative Pipeline ↗</button>
                        </div>

                        <div class="cc-table-wrap">
                            <table class="cc-table">
                                <thead>
                                    <tr>
                                        <th>Campaign Name</th>
                                        <th>Client Brand</th>
                                        <th>Roster Allocation</th>
                                        <th>Total Budget</th>
                                        <th>Deliverables Status</th>
                                        <th>Stage</th>
                                        <th>Management</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><strong>Spring in motion</strong></td>
                                        <td>Vela Active</td>
                                        <td>Thando Mokoena, Naledi D., Sipho K.</td>
                                        <td><strong>R60,000</strong></td>
                                        <td>8 / 12 Approved</td>
                                        <td><span class="cc-tag cc-tag-pending">Draft QC</span></td>
                                        <td><button class="cc-btn cc-btn-nav cc-primary" data-command="setPage('journey')">Manage Brief →</button></td>
                                    </tr>
                                    <tr>
                                        <td><strong>Morning Ritual</strong></td>
                                        <td>Homegrown Coffee</td>
                                        <td>Thando Mokoena, Zanele N.</td>
                                        <td><strong>R25,000</strong></td>
                                        <td>4 / 4 Approved</td>
                                        <td><span class="cc-tag cc-tag-completed">Payment Prep</span></td>
                                        <td><button class="cc-btn cc-btn-nav" data-command="setWorkspaceTab('Inbox')">Client Thread</button></td>
                                    </tr>
                                    <tr>
                                        <td><strong>Urban Movement 2026</strong></td>
                                        <td>Peak Athletics</td>
                                        <td>Sipho Khumalo, 4 creators</td>
                                        <td><strong>R95,000</strong></td>
                                        <td>Brief Issued</td>
                                        <td><span class="cc-tag">Contracting</span></td>
                                        <td><button class="cc-btn cc-btn-nav" data-command="setWorkspaceTab('Roster')">Assign Talent</button></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <!-- Brand Campaign Management Deck -->
                        <div class="cc-subnav-row">
                            <div class="cc-filter-pills">
                                <button class="cc-filter-pill active">Spring in motion (Active)</button>
                                <button class="cc-filter-pill">Winter Fitness (Archived)</button>
                            </div>
                            <button class="cc-btn cc-primary cc-btn-nav" data-command="setPage('journey')">Inspect Full Brief Pipeline ↗</button>
                        </div>

                        <div class="cc-box">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
                                <div>
                                    <div class="cc-kicker" style="color:#A3E635;">DELIVERABLES AWAITING BRAND APPROVAL</div>
                                    <h3 style="font-size:20px; margin-top:4px;">Pending Creative Sign-off</h3>
                                </div>
                                <span class="cc-tag cc-tag-pending">2 Items Need Your Review</span>
                            </div>

                            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
                                <div style="background:#19221B; padding:20px; border-radius:12px; border:1px solid var(--cc-line);">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                        <strong>Thando Mokoena</strong>
                                        <span class="cc-tag cc-tag-pending">Version 1 · Checked by Agency</span>
                                    </div>
                                    <p class="cc-small" style="color:#FFFFFF; margin-bottom:14px;">1x 60s Reel: Outdoor Run & Natural Product Integration in Camps Bay</p>
                                    <div style="display:flex; gap:10px;">
                                        <button class="cc-btn cc-primary cc-btn-nav" data-command="approveBrandDeliverable('Thando Mokoena')">Approve Deliverable ✓</button>
                                        <button class="cc-btn cc-btn-nav" data-command="setWorkspaceTab('Inbox')">Request Revision</button>
                                    </div>
                                </div>

                                <div style="background:#19221B; padding:20px; border-radius:12px; border:1px solid var(--cc-line);">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                        <strong>Naledi Dube</strong>
                                        <span class="cc-tag cc-tag-completed">Approved for 18 Sep</span>
                                    </div>
                                    <p class="cc-small" style="color:#FFFFFF; margin-bottom:14px;">3x Instagram Stories: Hydration Routine & Discount Link Sticker</p>
                                    <div style="display:flex; gap:10px;">
                                        <button class="cc-btn cc-btn-nav" data-command="setPage('journey')">View Pipeline Status</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (state.activeWorkspaceTab === 'Income' || state.activeWorkspaceTab === 'Partners' || state.activeWorkspaceTab === 'Roster') {
                    subViewContent = isCreator ? `
                        <!-- Creator Cash Flow Ledger -->
                        <div class="cc-metrics">
                            <div class="cc-metric">
                                <div class="cc-small">September Cash Inflow</div>
                                <div class="cc-num" style="color:#A3E635;">R38,500.00</div>
                                <span class="cc-small">Across 4 verified brand settlements</span>
                            </div>
                            <div class="cc-metric">
                                <div class="cc-small">Outstanding Invoices</div>
                                <div class="cc-num">R18,000.00</div>
                                <span class="cc-small">2 contracts in payment cycle</span>
                            </div>
                            <div class="cc-metric">
                                <div class="cc-small">Average Settlement Speed</div>
                                <div class="cc-num">6.2 Days</div>
                                <span class="cc-small">100% on-time settlement rate</span>
                            </div>
                        </div>

                        <div class="cc-box">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                                <h3>Official Financial & Invoice Ledger</h3>
                                <button class="cc-btn cc-btn-nav" data-command="downloadInvoiceProof('TAX-REPORT-2026')">About sample records</button>
                            </div>

                            <div class="cc-table-wrap">
                                <table class="cc-table">
                                    <thead>
                                        <tr>
                                            <th>Invoice ID</th>
                                            <th>Counterparty Brand</th>
                                            <th>Campaign Reference</th>
                                            <th>Amount (ZAR)</th>
                                            <th>Due Date</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><strong>#INV-2026-089</strong></td>
                                            <td>Vela Active</td>
                                            <td>Spring in motion #CCF-024</td>
                                            <td><strong>R12,000.00</strong></td>
                                            <td>30 Sep 2026</td>
                                            <td><span class="cc-tag cc-tag-pending">Scheduled Payout</span></td>
                                            <td><button class="cc-btn cc-btn-nav" data-command="downloadInvoiceProof('INV-089')">Sample invoice details</button></td>
                                        </tr>
                                        <tr>
                                            <td><strong>#INV-2026-084</strong></td>
                                            <td>Homegrown Coffee</td>
                                            <td>Morning ritual #CCF-019</td>
                                            <td><strong>R6,000.00</strong></td>
                                            <td>24 Sep 2026</td>
                                            <td><span class="cc-tag cc-tag-pending">Approved & Queued</span></td>
                                            <td><button class="cc-btn cc-btn-nav" data-command="downloadInvoiceProof('INV-084')">Sample invoice details</button></td>
                                        </tr>
                                        <tr>
                                            <td><strong>#INV-2026-077</strong></td>
                                            <td>Peak Athletics</td>
                                            <td>Urban movement #CCF-012</td>
                                            <td><strong>R8,500.00</strong></td>
                                            <td>31 Aug 2026</td>
                                            <td><span class="cc-tag cc-tag-completed">Paid ✓</span></td>
                                            <td><button class="cc-btn cc-btn-nav" data-command="downloadInvoiceProof('INV-077')">Sample receipt details</button></td>
                                        </tr>
                                        <tr>
                                            <td><strong>#INV-2026-062</strong></td>
                                            <td>Cape Botanics</td>
                                            <td>Winter Wellness launch</td>
                                            <td><strong>R12,000.00</strong></td>
                                            <td>15 Aug 2026</td>
                                            <td><span class="cc-tag cc-tag-completed">Paid ✓</span></td>
                                            <td><button class="cc-btn cc-btn-nav" data-command="downloadInvoiceProof('INV-062')">Sample receipt details</button></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ` : isAgency ? `
                        <!-- Agency Creator Roster Directory -->
                        <div class="cc-subnav-row">
                            <div class="cc-filter-pills">
                                <button class="cc-filter-pill active">All Roster (24)</button>
                                <button class="cc-filter-pill">Lifestyle & Tech (8)</button>
                                <button class="cc-filter-pill">Wellness & Fitness (11)</button>
                                <button class="cc-filter-pill">Food & Culture (5)</button>
                            </div>
                            <button class="cc-btn cc-primary cc-btn-nav" disabled aria-label="Creator invitations are not available in the demo">Invitations · not available</button>
                        </div>

                        <div class="cc-table-wrap">
                            <table class="cc-table">
                                <thead>
                                    <tr>
                                        <th>Creator</th>
                                        <th>Niche Focus</th>
                                        <th>Audience Reach</th>
                                        <th>Engagement Rate</th>
                                        <th>Active Campaigns</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            <div style="display:flex; align-items:center; gap:10px;">
                                                <span class="cc-avatar" style="width:30px; height:30px; font-size:11px;">TM</span>
                                                <strong>Thando Mokoena</strong>
                                            </div>
                                        </td>
                                        <td>Lifestyle & Outdoor Video</td>
                                        <td>84,200</td>
                                        <td><strong style="color:#A3E635;">4.9%</strong></td>
                                        <td>Spring in motion, Morning ritual</td>
                                        <td><span class="cc-tag cc-tag-completed">Active Brief</span></td>
                                        <td><button class="cc-btn cc-btn-nav" data-command="setWorkspaceTab('Inbox')">Direct Message</button></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div style="display:flex; align-items:center; gap:10px;">
                                                <span class="cc-avatar" style="width:30px; height:30px; font-size:11px;">ND</span>
                                                <strong>Naledi Dube</strong>
                                            </div>
                                        </td>
                                        <td>Wellness & Hydration</td>
                                        <td>112,000</td>
                                        <td><strong style="color:#A3E635;">5.2%</strong></td>
                                        <td>Spring in motion</td>
                                        <td><span class="cc-tag cc-tag-completed">Active Brief</span></td>
                                        <td><button class="cc-btn cc-btn-nav" data-command="setWorkspaceTab('Inbox')">Direct Message</button></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div style="display:flex; align-items:center; gap:10px;">
                                                <span class="cc-avatar" style="width:30px; height:30px; font-size:11px;">SK</span>
                                                <strong>Sipho Khumalo</strong>
                                            </div>
                                        </td>
                                        <td>Athletics & Gym Training</td>
                                        <td>65,400</td>
                                        <td><strong style="color:#A3E635;">6.1%</strong></td>
                                        <td>Spring in motion</td>
                                        <td><span class="cc-tag cc-tag-completed">Active Brief</span></td>
                                        <td><button class="cc-btn cc-btn-nav" data-command="setWorkspaceTab('Inbox')">Direct Message</button></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <!-- Brand Creator Partners & ROI Scorecard -->
                        <div class="cc-box">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                                <div>
                                    <div class="cc-kicker" style="color:#A3E635;">CAMPAIGN ROSTER & PERFORMANCE METRICS</div>
                                    <h3 style="font-size:20px; margin-top:4px;">Vela Active Activated Partners</h3>
                                </div>
                                <span class="cc-tag cc-tag-completed">3 Creators Active</span>
                            </div>

                            <div class="cc-table-wrap">
                                <table class="cc-table">
                                    <thead>
                                        <tr>
                                            <th>Creator</th>
                                            <th>Deliverables</th>
                                            <th>Allocated Fee</th>
                                            <th>Projected Views</th>
                                            <th>Engagement Rate</th>
                                            <th>Tracked Clicks</th>
                                            <th>Deliverable QC</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><strong>Thando Mokoena</strong></td>
                                            <td>1 Video + 3 Stories</td>
                                            <td><strong>R12,000</strong></td>
                                            <td>45,000</td>
                                            <td><strong style="color:#A3E635;">4.9%</strong></td>
                                            <td>920 clicks</td>
                                            <td><span class="cc-tag cc-tag-pending">Draft In Review</span></td>
                                        </tr>
                                        <tr>
                                            <td><strong>Naledi Dube</strong></td>
                                            <td>3 Instagram Stories</td>
                                            <td><strong>R15,000</strong></td>
                                            <td>60,000</td>
                                            <td><strong style="color:#A3E635;">5.2%</strong></td>
                                            <td>810 clicks</td>
                                            <td><span class="cc-tag cc-tag-completed">Approved</span></td>
                                        </tr>
                                        <tr>
                                            <td><strong>Sipho Khumalo</strong></td>
                                            <td>1 TikTok Video</td>
                                            <td><strong>R15,000</strong></td>
                                            <td>40,000</td>
                                            <td><strong style="color:#A3E635;">6.1%</strong></td>
                                            <td>410 clicks</td>
                                            <td><span class="cc-tag cc-tag-completed">Approved</span></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                } else if (state.activeWorkspaceTab === 'Inbox') {
                    const messages = state.chatMessages[role] || [];
                    subViewContent = `
                        <div class="cc-inbox-layout">
                            <div class="cc-inbox-threads">
                                <div class="cc-thread-item active">
                                    <span class="cc-avatar-mini" style="color:var(--cc-accent);">SN</span>
                                    <div class="cc-thread-info">
                                        <strong>Studio North <span>10:24 AM</span></strong>
                                        <p>Spring in motion: brief update</p>
                                    </div>
                                </div>
                                <div class="cc-thread-item">
                                    <span class="cc-avatar-mini" style="color:#60A5FA;">VA</span>
                                    <div class="cc-thread-info">
                                        <strong>Vela Active <span>Yesterday</span></strong>
                                        <p>Approved deliverable schedule</p>
                                    </div>
                                </div>
                                <div class="cc-thread-item">
                                    <span class="cc-avatar-mini" style="color:#FBBF24;">HC</span>
                                    <div class="cc-thread-info">
                                        <strong>Homegrown Coffee <span>31 Aug</span></strong>
                                        <p>Payment processed successfully</p>
                                    </div>
                                </div>
                            </div>

                            <div class="cc-chat-pane">
                                <div class="cc-chat-header">
                                    <div style="display:flex; align-items:center; gap:12px;">
                                        <span class="cc-avatar-mini" style="color:var(--cc-accent);">SN</span>
                                        <div>
                                            <strong style="font-size:14px; color:#FFFFFF;">Studio North (Nadia - Campaign Lead)</strong>
                                            <div class="cc-small">Campaign #CCF-024 · Spring in motion</div>
                                        </div>
                                    </div>
                                    <button class="cc-btn cc-btn-nav" data-command="setPage('journey')">View Brief Pipeline ↗</button>
                                </div>

                                <div class="cc-chat-messages" id="chat-messages-container">
                                    ${messages.map(m => `
                                        <div class="cc-msg-bubble ${m.incoming ? 'cc-msg-incoming' : 'cc-msg-outgoing'}">
                                            <div style="font-size:11px; font-weight:700; opacity:0.8; margin-bottom:4px;">${m.sender}</div>
                                            <div>${m.text}</div>
                                            <span class="cc-msg-time">${m.time}</span>
                                        </div>
                                    `).join('')}
                                </div>

                                <div class="cc-chat-input-bar">
                                    <input type="text" id="chat-input-field" class="cc-chat-input" placeholder="Type a message or brief update..." />
                                    <button class="cc-btn cc-primary cc-btn-nav" data-command="sendChatMessage('${role}')">Send</button>
                                </div>
                            </div>
                        </div>
                    `;
                }

                viewport.innerHTML = `
                    <div class="cc-shell cc-demo-shell cc-role-${role}">
                        <aside class="cc-side cc-demo-side">
                            <div class="cc-kicker">${roleLabel} workspace · preview</div>
                            <button class="${state.activeWorkspaceTab === 'Overview' ? 'cc-active' : ''}" data-command="setWorkspaceTab('Overview')">
                                <i data-lucide="layout-dashboard"></i> Overview
                            </button>
                            <button class="${state.activeWorkspaceTab === 'Campaigns' ? 'cc-active' : ''}" data-command="setWorkspaceTab('Campaigns')">
                                <i data-lucide="layers"></i> Campaigns
                            </button>
                            <button class="${(state.activeWorkspaceTab === 'Income' || state.activeWorkspaceTab === 'Partners' || state.activeWorkspaceTab === 'Roster') ? 'cc-active' : ''}" data-command="setWorkspaceTab('${isCreator ? 'Income' : isAgency ? 'Roster' : 'Partners'}')">
                                <i data-lucide="users"></i> ${isCreator ? 'Income' : isAgency ? 'Creator roster' : 'Creator partners'}
                            </button>
                            <button class="${state.activeWorkspaceTab === 'Inbox' ? 'cc-active' : ''}" data-command="setWorkspaceTab('Inbox')">
                                <i data-lucide="message-square"></i> Inbox
                            </button>
                            <button data-command="setPage('journey')">
                                <i data-lucide="arrow-right-left"></i> Shared journey
                            </button>
                        </aside>

                        <main class="cc-main cc-demo-main">
                            <div class="cc-demo-context"><span><i></i>Interactive product preview</span><b>${roleLabel} perspective</b></div>
                            <div class="cc-title-row cc-demo-title">
                                <div>
                                    <div class="cc-kicker">${roleLabel} / ${state.activeWorkspaceTab}</div>
                                    <h2>${isCreator ? 'Good morning, ' : ''}${roleName}${isCreator ? '.' : ''}</h2>
                                    <p>${isCreator ? 'Your work is moving. Here’s where your money stands.' : isAgency ? 'Your campaigns, creators and next decisions.' : 'See what’s working. Keep your campaign moving.'}</p>
                                </div>
                                <div class="cc-demo-title-actions"><button class="cc-btn cc-primary" data-command="openCampaignFlow('${role}')">Open shared campaign →</button><span class="cc-avatar">${roleAvatar}</span></div>
                            </div>

                            ${subViewContent}
                        </main>
                    </div>
                `;
            } else if (state.page === 'journey') {
                const s = stages[state.step];
                viewport.innerHTML = `
                    <section class="cc-flow">
                        <div class="cc-title-row">
                            <div>
                                <div class="cc-kicker">One campaign. Three perspectives.</div>
                                <h2>Spring in motion</h2>
                                <p class="cc-small">Vela Active × Studio North × Thando Mokoena</p>
                            </div>
                            <span class="cc-badge-journey">Shared campaign workspace</span>
                        </div>

                        <div class="cc-steps">
                            ${stages.map((x, i) => `
                                <button class="cc-step-btn" data-step="${i}" aria-pressed="${i === state.step}" data-command="setStep(${i})">
                                    <span style="color: ${i === state.step ? '#A3E635' : 'var(--cc-muted)'}">0${i + 1} · ${x[0]}</span><br>
                                    <strong>${x[1]}</strong>
                                </button>
                            `).join('')}
                        </div>

                        <div class="cc-flow-detail">
                            <div class="cc-box">
                                <div class="cc-kicker" style="color: #A3E635;">${s[0]} is responsible</div>
                                <h2>${s[1]}</h2>
                                <p class="cc-small" style="margin-bottom: 20px;">${s[2]}</p>

                                <div class="cc-campaign-banner">
                                    <div class="cc-small" style="letter-spacing: 1px; color: #A3E635; font-weight: 700;">SPRING IN MOTION</div>
                                    <h3 style="font-size: 22px; margin: 8px 0;">${s[5]}</h3>
                                    <div class="cc-small">Campaign #CCF-024 · shared record</div>
                                </div>

                                <button class="cc-btn cc-primary" data-command="nextStep()" style="padding: 12px 24px; font-size: 14px;">${s[3]} →</button>
                                <div class="cc-small" style="margin-top: 14px;">
                                    ${state.step === 5 ? 'Payment is tracked separately from content approval.' : 'Next handoff: ' + s[4]}
                                </div>
                            </div>

                            <div class="cc-box">
                                <h3>Who sees what</h3>
                                ${renderRow('Creator', 'Own fee, tasks and invoice', 'Personal')}
                                ${renderRow('Agency', 'Assigned creators, reviews and budget', 'Managed')}
                                ${renderRow('Brand', 'Campaign spend and final approvals', 'Campaign')}
                                <div class="cc-small" style="margin-top: 18px; line-height: 1.6;">
                                    Personal income and other client campaigns stay private. Shared comments stay with this campaign.
                                </div>
                            </div>
                        </div>
                    </section>
                `;
            }

            if (window.lucide) {
                lucide.createIcons();
            }
        }

        function syncDemoEmail(role) {
            const input = document.getElementById('demo-email-input');
            if (!input) return;
            if (role === 'creator') input.value = 'thando@example.com';
            else if (role === 'agency') input.value = 'contact@studionorth.co.za';
            else if (role === 'brand') input.value = 'campaigns@velaactive.com';
        }

        function executeDemoLogin() {
            const select = document.getElementById('demo-role-select');
            const targetRole = select ? select.value : 'creator';
            setPage(targetRole);
        }

        // Initialize App on DOM Ready & Support URL Hash Routing
        document.addEventListener('DOMContentLoaded', () => {
            const hash = window.location.hash.replace('#', '');
            if (['landing', 'login', 'creator', 'agency', 'brand', 'journey'].includes(hash)) {
                state.page = hash;
            }
            render();

            window.addEventListener('hashchange', () => {
                const newHash = window.location.hash.replace('#', '');
                if (['landing', 'login', 'creator', 'agency', 'brand', 'journey'].includes(newHash)) {
                    if (state.page !== newHash) {
                        setPage(newHash, false);
                    }
                }
            });
        });

