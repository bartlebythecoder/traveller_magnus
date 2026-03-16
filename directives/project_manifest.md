# Project Manifest: Traveller World & Star System Creator

## Current Sprint: CT Bottom-Up Completion
**Primary Goal:** Complete the logic for the Bottom-Up generation in the Classic Traveller (CT) engine and finalize the modular refactor.

### Active Tasks
* [ ] Implement Bottom-Up logic in `ct_bottomup_generator.js`.
* [ ] Ensure `ct_system_driver.js` correctly routes between Top-Down and Bottom-Up.
* [ ] Verify all CT tables are moved from ct_constants.js into /rules/ct_data.js.".
* [ ] Test `.txt` log output for both generation directions.

### Future Backlog
* [ ] Refactor Mongoose (MgT2e) into the CT modular structure.
* [ ] Refactor Traveller 5 (T5) into the CT modular structure.
* [ ] Implement Zozer's Hostile engine.
* [ ] Explore SQLite 3 and Obsidian data exports.

## Technical Constraints
* **Language:** Vanilla JavaScript / HTML / CSS.
* **Architecture:** Modular, bidirectional (Top-Down/Bottom-Up).
* **Logs:** Automatic `.txt` downloads (user-controlled toggle).