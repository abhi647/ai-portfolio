// The demo storyboard. Each scene pairs the narration line (for ElevenLabs)
// with the on-screen actions. The recorder holds every scene at least as long
// as its narration takes to read, so the generated audio lines up.

const card = (text) => `xpath=//*[normalize-space(text())='${text}']/ancestor::div[contains(@class,'rounded-xl')][1]`;

export const videos = [
  {
    id: 'admin',
    name: 'Admin walkthrough',
    fresh: true,
    scenes: [
      {
        id: 'A01',
        title: 'Intro',
        narration:
          'Welcome to AI Portfolio Recommendation: a private, browser-based workspace for building and reviewing equity portfolios on Indian markets. In this walkthrough, we will sign in as an Admin and set up a project from scratch.',
        async run(d) {
          await d.cursorVisible(false);
          await d.title('Product walkthrough', 'AI Portfolio Recommendation', 'Admin view: from sign-in to a live project');
          await d.wait(9000);
          await d.clearTitle();
          await d.wait(700);
          await d.cursorVisible(true);
        },
      },
      {
        id: 'A02',
        title: 'Local-first',
        narration:
          'First, notice the Local Mode note. The app runs entirely in your browser. Price data, projects and settings are stored on your device, and nothing is sent to a server.',
        async run(d) {
          await d.moveTo('div.bg-muted:has-text("Local Mode")', { dx: -80 });
          await d.spotlight('div.bg-muted:has-text("Local Mode")', 8);
          await d.callout('div.bg-muted:has-text("Local Mode")', '<b>Local-first.</b> Your data never leaves the browser.', { placement: 'bottom' });
          await d.wait(5500);
        },
      },
      {
        id: 'A03',
        title: 'Sign in as Admin',
        narration:
          'To sign in, enter a name, then choose a role. The Admin role has full access: creating projects, loading data and running analysis. Then click Continue.',
        async run(d) {
          await d.type('#username', 'Portfolio Admin');
          await d.wait(400);
          await d.click('button:has-text("Full access")');
          await d.callout('button:has-text("Full access")', '<b>Admin</b>: create projects, load data, run analysis', { placement: 'left' });
          await d.wait(3200);
          await d.clearCallout();
          await d.click('button:has-text("Continue")');
          await d.page.waitForURL('**/dashboard');
        },
      },
      {
        id: 'A04',
        title: 'Empty dashboard',
        narration:
          'With no project yet, the dashboard offers two ways to start: create a new project, or import an existing project bundle. We will create a new one.',
        async run(d) {
          await d.wait(600);
          await d.spotlight(card('Welcome to AI Portfolio'), 6);
          await d.moveTo('a:has-text("Create New Project")');
          await d.callout('a:has-text("Create New Project")', '<b>Start here:</b> guided project setup', { placement: 'bottom' });
          await d.wait(4200);
          await d.clearAll();
          await d.click('a:has-text("Create New Project")');
          await d.page.waitForURL('**/onboarding');
        },
      },
      {
        id: 'A05',
        title: 'Name the project',
        narration: 'Project setup is a guided, four-step wizard. Step one: give the project a name.',
        async run(d) {
          await d.wait(400);
          await d.callout('h2:has-text("Create New Project") + div', 'Four steps: <b>Setup → Data → Benchmark → Review</b>', { placement: 'bottom' });
          await d.wait(1800);
          await d.clearCallout();
          await d.type('#project-name', 'Indian Large Caps Q3 2026');
        },
      },
      {
        id: 'A06',
        title: 'Load data',
        narration:
          'Normally, step two is where you upload three CSV files: daily price data, a sector mapping, and your benchmark index. Each file is checked right in the browser, with row counts, errors and warnings. For this demo, we will load the built-in sample of ten large-cap Indian stocks.',
        async run(d) {
          const box = 'div.border-dashed:has-text("Try with demo data")';
          await d.moveTo(box, { dx: 120 });
          await d.spotlight(box, 6);
          await d.callout(box, '<span class="step">2</span>Upload <b>prices</b>, <b>sectors</b> and <b>benchmark</b> CSVs, or use sample data', { placement: 'bottom' });
          await d.wait(15000);
          await d.clearAll();
          await d.click('button:has-text("Use Demo Data")');
        },
      },
      {
        id: 'A07',
        title: 'Benchmark',
        narration: 'Step three sets the benchmark used to measure alpha. NIFTY 50 is filled in by default, so we can move on.',
        async run(d) {
          await d.wait(300);
          await d.moveTo('#benchmark');
          await d.callout('#benchmark', '<span class="step">3</span>Benchmark for alpha: <b>NIFTY50</b>', { placement: 'bottom' });
          await d.wait(3000);
          await d.clearCallout();
          await d.click('button:has-text("Next")');
        },
      },
      {
        id: 'A08',
        title: 'Review and create',
        narration:
          'Step four is a final review: project name, benchmark, the number of price records, and the stocks covered. Everything looks right, so let us create the project.',
        async run(d) {
          await d.wait(300);
          await d.spotlight('div.grid.grid-cols-2', 12);
          await d.callout('div.grid.grid-cols-2', '<span class="step">4</span>Check the setup before creating', { placement: 'right' });
          await d.moveTo('div.grid.grid-cols-2');
          await d.wait(5200);
          await d.clearAll();
          await d.click('button:has-text("Create Project")');
          await d.page.waitForURL('**/dashboard');
        },
      },
      {
        id: 'A09',
        title: 'Portfolio dashboard',
        narration:
          'And we land on the portfolio dashboard. The top row shows the headline numbers at a glance: compound annual growth, maximum drawdown, the Sortino ratio for risk-adjusted return, and the number of active signals, split into buy, hold and sell.',
        async run(d) {
          await d.wait(700);
          const kpis = [
            ['CAGR', '<b>CAGR</b>: compound annual growth'],
            ['Max Drawdown', '<b>Max drawdown</b>: worst peak-to-trough fall'],
            ['Sortino Ratio', '<b>Sortino</b>: return per unit of downside risk'],
            ['Active Signals', '<b>Signals</b>: BUY / HOLD / SELL split'],
          ];
          for (const [label, text] of kpis) {
            await d.moveTo(card(label));
            await d.spotlight(card(label), 6);
            await d.callout(card(label), text, { placement: 'bottom' });
            await d.wait(2300);
          }
        },
      },
      {
        id: 'A10',
        title: 'Charts and quick actions',
        narration:
          'Below that are the equity curve and sector exposure panels, which fill in once analysis runs. As an Admin, you also get quick actions to run a backtest, build a what-if scenario, or generate a report.',
        async run(d) {
          await d.moveTo(card('Equity Curve'));
          await d.callout(card('Equity Curve'), '<b>Equity curve</b> vs. benchmark', { id: 'eq', placement: 'top' });
          await d.wait(1600);
          await d.moveTo(card('Sector Exposure'));
          await d.callout(card('Sector Exposure'), '<b>Sector exposure</b> by allocation', { id: 'sec', placement: 'top' });
          await d.wait(2000);
          await d.clearCallout();
          await d.spotlight(card('Quick Actions'), 6);
          await d.moveTo('a:has-text("Run Backtest")');
          await d.callout(card('Quick Actions'), '<b>Admin only:</b> backtest, scenarios, reports', { placement: 'top' });
          await d.wait(4000);
        },
      },
      {
        id: 'A11',
        title: 'Navigation and theme',
        narration:
          'The sidebar is your map to every module: signals, portfolio, risk, backtesting, simulation and reports. It collapses to give charts more room, and light or dark themes are one click away.',
        async run(d) {
          await d.moveTo('aside nav', { dy: -80 });
          await d.spotlight('aside nav', 4);
          await d.callout('aside nav', 'Every module, one click away', { placement: 'right' });
          await d.wait(4200);
          await d.clearAll();
          await d.click('button[aria-label="Toggle sidebar"]');
          await d.wait(1200);
          await d.click('button[aria-label="Toggle sidebar"]');
          await d.wait(600);
          await d.click('button[aria-label="Toggle theme"]');
          await d.callout('button[aria-label="Toggle theme"]', '<b>Dark mode</b>', { placement: 'bottom' });
          await d.wait(1800);
          await d.clearCallout();
          await d.click('button[aria-label="Toggle theme"]');
        },
      },
      {
        id: 'A12',
        title: 'Outro',
        narration:
          'That is the Admin workflow: from sign-in to a live project in about a minute, with all of your data staying on your own device.',
        async run(d) {
          await d.wait(1200);
          await d.cursorVisible(false);
          await d.title('Admin view', 'From sign-in to live project', 'Local-first · Guided setup · Full control');
          await d.wait(5000);
        },
      },
    ],
  },
  {
    id: 'stakeholder',
    name: 'Stakeholder walkthrough',
    // Starts logged out but with the project the Admin created still in storage.
    fresh: false,
    scenes: [
      {
        id: 'S01',
        title: 'Intro',
        narration:
          'Now let us look at AI Portfolio Recommendation from the Stakeholder side: the view for investment committee members, clients, or anyone who needs to review results without changing them.',
        async run(d) {
          await d.cursorVisible(false);
          await d.title('Product walkthrough', 'AI Portfolio Recommendation', 'Stakeholder view: read-only portfolio review');
          await d.wait(8500);
          await d.clearTitle();
          await d.wait(700);
          await d.cursorVisible(true);
        },
      },
      {
        id: 'S02',
        title: 'Sign in as Stakeholder',
        narration: 'Stakeholders sign in the same way. Enter a name, and pick the Stakeholder role, which is read-only.',
        async run(d) {
          await d.type('#username', 'Investment Committee');
          await d.wait(300);
          await d.click('button:has-text("Read-only")');
          await d.callout('button:has-text("Read-only")', '<b>Stakeholder</b>: view results, no edits', { placement: 'right' });
          await d.wait(2800);
          await d.clearCallout();
          await d.click('button:has-text("Continue")');
          await d.page.waitForURL('**/dashboard');
        },
      },
      {
        id: 'S03',
        title: 'Portfolio view',
        narration:
          'The header switches to Portfolio View, and the badge confirms you are signed in as a Stakeholder. You are looking at the same project the Admin set up.',
        async run(d) {
          await d.wait(600);
          await d.moveTo('header h1');
          await d.callout('header h1', 'Stakeholders get the <b>Portfolio View</b>', { placement: 'bottom' });
          await d.wait(2800);
          await d.clearCallout();
          await d.moveTo('header div.border:has-text("stakeholder")');
          await d.spotlight('header div.border:has-text("stakeholder")', 6);
          await d.callout('header div.border:has-text("stakeholder")', 'Signed in as <b>Stakeholder</b>', { placement: 'bottom' });
          await d.wait(2800);
        },
      },
      {
        id: 'S04',
        title: 'Key numbers',
        narration:
          'The key numbers are all here: growth, drawdown, risk-adjusted return, and how many buy, hold and sell signals are active right now.',
        async run(d) {
          const row = 'div.grid:has-text("CAGR")';
          await d.spotlight(row, 10);
          await d.callout(row, 'Headline <b>performance and risk</b> at a glance', { placement: 'bottom' });
          await d.moveTo(card('CAGR'));
          await d.wait(1500);
          await d.moveTo(card('Active Signals'));
          await d.wait(3200);
        },
      },
      {
        id: 'S05',
        title: 'Read-only by design',
        narration:
          'What is missing is intentional. There are no quick actions to run backtests, change scenarios or create projects, so the numbers you review cannot be altered by accident.',
        async run(d) {
          await d.moveTo(card('Sector Exposure'), { dy: 150 });
          await d.callout(card('Sector Exposure'), '<b>Read-only:</b> no backtest, scenario or report actions', { placement: 'bottom' });
          await d.wait(6000);
        },
      },
      {
        id: 'S06',
        title: 'Personalise',
        narration: 'Viewers can still personalise their experience, like switching to dark mode for a late-night review.',
        async run(d) {
          await d.click('button[aria-label="Toggle theme"]');
          await d.callout('button[aria-label="Toggle theme"]', 'Theme is a <b>personal</b> setting', { placement: 'bottom' });
          await d.wait(3500);
        },
      },
      {
        id: 'S07',
        title: 'Sign out',
        narration: 'When you are done, sign out from the top right. The session ends, and you are back at the login screen.',
        async run(d) {
          await d.moveTo('button[aria-label="Logout"]');
          await d.callout('button[aria-label="Logout"]', '<b>Sign out</b>', { placement: 'bottom' });
          await d.wait(1600);
          await d.clearCallout();
          await d.click('button[aria-label="Logout"]');
          await d.page.waitForURL('**/login');
        },
      },
      {
        id: 'S08',
        title: 'Outro',
        narration: 'That is the Stakeholder view: clear, read-only access to the portfolio. Thanks for watching.',
        async run(d) {
          await d.wait(800);
          await d.cursorVisible(false);
          await d.title('Stakeholder view', 'Clear, read-only portfolio access', 'Review with confidence');
          await d.wait(4500);
        },
      },
    ],
  },
];
