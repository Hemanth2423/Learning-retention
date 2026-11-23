# Share notebook export storage

Notion and Google Docs use the same notebook format and the same Convex tables. The provider is part of each lookup so both integrations can coexist for a reader and each book can be sent to both destinations.

The export action checks book ownership before reading notes or using a saved destination. OAuth tokens stay in server-only storage. A saved remote page ID lets a reader update the page without changing its link.
