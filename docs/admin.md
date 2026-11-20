# Common Hours staff workspace

[Open the staff dashboard on GitHub](https://github.com/rongsenzhang/common-hours-admin). Sign in with a GitHub account that has access to that private repository. Its README lists benchmark queries alphabetically, with stable case identifiers and the three retrieval methods. Choose a query to see the reference judgement and actual results. GitHub controls access to the published dashboard and stored snapshot.

## Open the interactive console

1. From the private repository, choose **Code → Codespaces** and open your own codespace. You can also clone the private repository and run the console on your computer.
2. In its terminal, run `python3 admin/serve.py --data-dir data`. Keep the terminal open. It displays a fresh staff access code.
3. Locally, open [the console on this computer](http://127.0.0.1:8765/). In Codespaces, open **Ports → 8765**, check that its visibility is **Private**, and open that port in a browser. Enter the access code from your terminal. A running codespace can consume the account’s Codespaces allowance.
4. Select **Benchmark** and choose a query from the A–Z list. Scores belong to the displayed snapshot. When the embedding snapshot is unavailable the workspace explicitly reports that status.
5. Select **Coordinator desk → Preview volunteer result**. On the initial snapshot the weekend garden role is under **To confirm**. Return to the desk, read the fictional host reply, confirm step-free access and reopen the preview. It now appears under **Matches**. Undo the change to restore the original. Staff confirmations persist for the browser tab’s session and do not change the public catalogue.
6. Stop the console with Ctrl+C. Stop the codespace through its Codespaces menu when finished. Restarting the console invalidates earlier access codes and sessions.

GitHub’s private forwarded ports require the codespace creator to authenticate. The console additionally asks for its own access code before serving its HTML, scripts or data. It binds to loopback and only serves explicitly registered files. [GitHub Codespaces port visibility](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace)

## Development checkout

From the public source checkout run `python3 admin/serve.py` to inspect the reproducible offline snapshot. Generated provider scores are available in the matching private release snapshot. Use `--data-dir /path/to/common-hours-admin/data` to inspect that copy. Generate its read-only GitHub view with `node admin/export-dashboard.mjs --data-dir /path/to/data --output README-preview.md`.

The public repository contains the implementation, synthetic fixtures and historical v1.0 release. The current volunteer Pages site serves the volunteer interface. GitHub access to the private repository and the console login protect the staff workspace. Keep real participant data and credentials out of both the public repository and synthetic sample files.

To test the interactive workflow with Playwright installed, run `node qa/admin-browser.cjs` from the source checkout. You can supply the private snapshot directory as an argument. The check starts an ephemeral console, verifies anonymous denial, signs in and tests alphabetical selection, the live dog-walking case and coordinator confirm/undo at desktop and phone widths.
