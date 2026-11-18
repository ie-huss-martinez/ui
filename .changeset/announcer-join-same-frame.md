---
"@hussmartinez/ui": patch
---

`useAnnounce` no longer loses messages sent in the same frame. Before, when two components announced in one commit, such as a child's effect and its parent's, only the last message was said. Now messages sent in the same frame with the same politeness are said together, in order, separated by a space, and the same message twice is said once. Polite and assertive messages stay separate, and a message in a later frame is said on its own, as before. End each message with its language's punctuation, so joined messages read as sentences. If you joined messages yourself to work around this, as `useJoinedAnnounce` in audio-sdk and video-sdk does, you can call `announce` directly again.
