# TEST46 — lettere opbygning

Brugeren vurderede TEST45 som klodset. Denne ændring bevarer den korte sidestruktur og erstatter tunge indramninger med tekstfaner, tynde skillelinjer og en mindre navigationsrail.

Kampsiden bruger nu `MatchDesk.jsx`: holdmærker og navne, turnering/sæson, kampvalg og tre reelle nøgletal. Den store dekorative klubgrafik og den gentagne overskrift er ikke med i denne visning. Det eksisterende ClubHub-layout bevares som historisk/fallback-visning for komponentens standardområde. Appens aktive kampfane bruger MatchDesk. Begge kampcallbacks, genoptagelse, igangværende simuleringers stilling og spærring ved spillerkarrierekamp er bevaret. Manuelle kampe får ikke opfundet en serverstilling.

Primær navigation og faner har færre fyldte felter. Spiluniversets valg og genveje vises med lettere flader. Login bevarer sin eksisterende logik, men mister den tunge kortindramning. Ingen kontroller er gjort mindre end deres eksisterende mindstemål for at få mere plads. Længere indhold er stadig tilgængeligt gennem den aktive fanes rulleområde.

Hjemmesiden beholder de tre sider og seks slides. Hovedfanerne ligger i headeren, og emnevalg ligger på én let linje. Countdown, illustrationer og juridiske links bevares. Store indramninger omkring præsentation og udgivelsesfelt er fjernet. Kun den eksisterende ejerprivate preview opdateres.

## Afgrænsning

Denne levering ændrer layout, ikke kampmotoren. TEST45's optimeringer af replay, joystick, skærmmålinger og sparkrotationer bevares. Grafikindstillinger, modeller, data, kampoptakt og gemmeprotokoller er uændret. APK 37, tidligere testudgaver, produktionsdatabasen, playtouchline.dk og main bevares.

Browserstyring er ikke eksponeret som et brugbart værktøj i sessionen, selv om miljøets desktopkapabilitet er markeret som tilgængelig. Projektets standard Playwright-runner er ikke installeret. Derfor er visuel browser- og fysisk Android-kontrol ikke gennemført; tests, bygning, signering og leverede filer kontrolleres særskilt. Ingen påstand om godkendt visuelt layout eller fysisk FPS.
