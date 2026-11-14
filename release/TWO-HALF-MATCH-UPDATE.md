# Build30 — two-minute halves and closer play

New manual matches use replay engine6: 120 seconds for each half, separated by a 10-second interval. The football clock holds at45:00 during the interval and reaches90:00 after250 seconds total. Second-half kickoff belongs to the away side. Input during the interval cannot move players or trigger actions. Closing/reopening resumes the same timeline; it does not restart the timer. Legacy versions1–5 retain their original duration and codec. Simulation stays at its existing quick duration.

The server now uses each engine's actual deadline and a three-minute upload grace period. Engine6 records5000 validated16-bit inputs; its padded packet is13336 characters. Only manual completion actions may exceed the usual4KiB request envelope, up to16KiB. The server replays the entire match, rejects premature completion and ignores forged score/reward fields. Duplicate completion still pays once.

TV Pro uses a closer fixed lens (offset24/2.4, height15, FOV42); TV is closer too. Ball/player separation never changes lens distance or FOV. The ball guides the target, with a bounded three-metre player offset, so long passes do not leave it behind. The ball has a view-dependent readable diameter targeting six CSS pixels, bounded between0.2508 and0.5 metres. Its world physics remain unchanged. Size uses the current camera after it has moved.

Auto retains the efficient9.5K-triangle models for the team and uses the detailed25.7K-triangle model for the controlled player and one nearby opponent. Hidden cached models are not drawn. Sharp/4K retain detailed models throughout. Both assets preserve existing licensed human rigs and animation. Menu/marketing appearance is locked; only duration/help labels change.

Validation:363 automated checks passed, plus3 web-draft checks and the stadium sightline tests expanded to engine6. New checks cover both exact half boundaries, frozen interval, second-half kickoff, final stop, deterministic padded recordings, session resume, premature/duplicate API completion, personal account isolation, fixed lens and ball projection at edge positions. Native packaging/signature, release metadata and private HTTPS delivery are checked separately. A live server timing/replay check uses temporary accounts, removed afterward.

No real-phone GPU screenshot, sustained FPS/thermal measurement or physical touch playtest is available in this environment. Automated geometry/replay checks do not certify the final visual experience or smoothness on the owner's phone.
