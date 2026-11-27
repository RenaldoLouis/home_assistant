# Move Jarvis voice conversations into ChatGPT

Founder direction, 2026-11-25. ChatGPT on the phone should host the assistant conversation. Jarvis supplies authorized actions. Boba task management is the first implementation task. Start with the founder’s personal Boba integration. Wider availability is a separate product decision.

## Implementation task

- Verify that the founder’s ChatGPT account and mobile Live interface can invoke a private connected app. Start with a harmless test action and record any on-screen approval required. [OpenAI connected apps guide](https://help.openai.com/en/articles/11487775-connected-apps-in-chatgpt)
- Inspect Boba’s existing personal sync, task repository and deletion behavior before choosing the connection. Establish which side owns each write and how the phone acknowledges it. Scope authorization to the linked owner and Boba tasks. Keep Jarvis banking, notifications and home controls outside this connection.
- Provide list/search, create, edit and delete actions. Resolve dates in Boba’s local day, identify tasks by stable ID and ask which task the speaker means when titles collide. Preserve unrelated fields and follow Boba’s existing parent/child rules. Confirm the exact deletion target and affected children.
- Make retries safe. Distinguish saved, pending and unsuccessful changes in the tool result so the spoken answer reflects what actually happened.
- Verify on the founder’s phone in one ChatGPT voice conversation. Create a disposable task, retrieve it, change its title or date, delete it, then check the result in Boba. Also check duplicate titles, a disconnected phone, repeated requests and denied access. Record any taps needed and the actual synchronization behavior.
- Plan retirement of the existing Jarvis voice flow after the replacement has been verified. Inventory other Jarvis capabilities separately before migrating any additional actions.

Status: assigned for implementation. Mobile compatibility, data flow and end-to-end behavior still require verification.

### Connector implementation boundary

Own the ChatGPT-facing tools, authentication, and spoken result handling here. Boba owns its Flutter task mirror. Follow the personal ChatGPT Voice contract in the Boba feature branch feature/personal-chatgpt-tasks, docs/15_jarvis_boba_handover.md. Correlate writes with assistantRevision and phoneAppliedRevision. Keep soft-deleted documents available for offline catch-up. Treat the historical jarvis_user_id path as a storage location only. Prove owner isolation before connecting it to a ChatGPT account.

The checked-in Jarvis Firestore rules cover expenses and households and do not grant access to task documents. Boba's current client also lacks Firebase Authentication. Coordinate the owner's phone identity with Boba before deployment. Do not grant access to the shared historical task path based on premium status.

Founder approved Google account linking. Target users/{verified founder Firebase UID}/tasks and require a server-provisioned personalTaskOwners/{uid} allowlist record. Boba sign-out disconnects its phone session. Implement connector revocation independently. The local rules change still needs emulator verification and release.

The completed service and runtime setup are in [the personal Boba connector](../../boba-connector/README.md). The merged Boba client supports account linking. Configure the verified owner and hosted endpoint before performing the mobile acceptance flow.
