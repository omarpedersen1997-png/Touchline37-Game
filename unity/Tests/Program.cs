using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text.Json;
using System.Diagnostics;
using Touchline.Core;

static class Program
{
    static int passed, failed;
    static readonly JsonSerializerOptions Options = new JsonSerializerOptions { IncludeFields = true, IgnoreReadOnlyProperties = true };
    static readonly string SeedPath = "unity/TouchlineUnity/Assets/Touchline/Resources/Touchline/Seeds/sandbox-club.json";
    static ClubProfile Club() => JsonSerializer.Deserialize<ClubProfile>(File.ReadAllText(SeedPath), Options);
    static void Check(bool value, string message = "assertion") { if (!value) throw new Exception(message); }
    static void Near(float a, float b, float epsilon = .00005f) => Check(MathF.Abs(a - b) < epsilon, $"{a} != {b}");
    static void Test(string name, Action run) { try { run(); passed++; Console.WriteLine("PASS " + name); } catch (Exception e) { failed++; Console.WriteLine("FAIL " + name + ": " + e.Message); } }
    static void Throws(Action run) { try { run(); } catch { return; } throw new Exception("Expected failure"); }
    static MatchSimulation Match(uint seed = 37) => new MatchSimulation(Club(), seed, "fixture");
    static string Encode(object value) => JsonSerializer.Serialize(value, Options);
    static void Playing(MatchSimulation sim) { for (int i = 0; i < 100 && sim.State.Phase != MatchPhase.Playing; i++) sim.Step(new MatchInput()); Check(sim.State.Phase == MatchPhase.Playing); }
    sealed class Codec : ITextCodec
    {
        public bool Fail;
        public string Encode<T>(T data) where T : class { if (Fail) throw new IOException("simulated disk/codec failure"); return JsonSerializer.Serialize(data, Options); }
        public T Decode<T>(string data) where T : class => JsonSerializer.Deserialize<T>(data, Options);
    }
    static int Main()
    {
        var golden = JsonDocument.Parse(File.ReadAllText("unity/TouchlineUnity/Assets/Touchline/Resources/Touchline/golden-domain.json"));
        foreach (var fixture in golden.RootElement.GetProperty("strengths").EnumerateArray())
        {
            var f = fixture;
            Test("JS strength " + f.GetProperty("formation").GetString() + " training " + f.GetProperty("training").GetInt32(), () => {
                var club = Club(); club.Formation = f.GetProperty("formation").GetString(); club.Training = f.GetProperty("training").GetInt32(); club.Coach = 2; club.ClubBonus = 3;
                club.Players = f.GetProperty("players").EnumerateArray().Select(p => new PlayerProfile { Id = p.GetProperty("id").GetString(), Name = p.GetProperty("name").GetString(), Position = p.GetProperty("position").GetString(), Rating = p.GetProperty("rating").GetInt32(), Potential = p.GetProperty("potential").GetInt32(), Development = p.GetProperty("development").GetInt32() }).ToList();
                Check(ClubRules.Strength(club) == f.GetProperty("expected").GetProperty("total").GetInt32());
            });
        }
        foreach (var fixture in golden.RootElement.GetProperty("balls").EnumerateArray())
        {
            var f = fixture;
            Test("JS ball " + f.GetProperty("input").GetProperty("flightKind").GetString() + " height " + f.GetProperty("input").GetProperty("z"), () => {
                var input = f.GetProperty("input"); var b = new BallState { Position = new V2(input.GetProperty("x").GetSingle(), input.GetProperty("y").GetSingle()), Height = input.GetProperty("z").GetSingle() - .11f, Velocity = new V2(input.GetProperty("vx").GetSingle(), input.GetProperty("vy").GetSingle()), UpVelocity = input.GetProperty("vz").GetSingle(), Spin = input.GetProperty("curl").GetSingle(), Kind = Enum.Parse<FlightKind>(input.GetProperty("flightKind").GetString(), true) };
                BallPhysics.Integrate(b, .05f); var expected = f.GetProperty("expected"); Near(b.Position.X, expected.GetProperty("x").GetSingle()); Near(b.Position.Z, expected.GetProperty("y").GetSingle()); Near(b.Height + .11f, expected.GetProperty("z").GetSingle()); Near(b.Velocity.X, expected.GetProperty("vx").GetSingle()); Near(b.Velocity.Z, expected.GetProperty("vy").GetSingle()); Near(b.UpVelocity, expected.GetProperty("vz").GetSingle());
            });
        }
        Test("kickoff is centred, supporting player is nearby, opponents stay in their own half outside circle", () => {
            var sim = Match(); var s = sim.State; Check(s.Ball.Position.Length == 0 && s.Ball.Owner == 9);
            Check(s.Players[6].Position.Length < 7); foreach (var p in s.Players) { Check(p.Position.Z * sim.Direction(p.Team) <= .001f); if (p.Team != s.KickTeam) Check(p.Position.Length >= 9.15f); }
            Playing(sim); Check(s.Ball.Owner == -1); Check(s.Ball.Velocity.Z < 0); Check(s.Ball.Velocity.Length < 12);
        });
        Test("tick cadence is identical at 30/60/120 draw callbacks", () => {
            var snapshots = new List<string>(); foreach (int hz in new[] {30,60,120}) { var step = new MatchStepper(Match()); for (int i = 0; i < hz * 12; i++) step.Advance(1d / hz, () => new MatchInput()); snapshots.Add(Encode(step.Simulation.State)); Check(step.Simulation.State.Tick == 720); } Check(snapshots.Distinct().Count() == 1);
        });
        Test("bounded catchup retains all ticks and converges exactly", () => {
            var a = new MatchStepper(Match()); Check(a.Advance(10, () => new MatchInput()) == 8); Check(a.PendingTicks > 500); while (a.PendingTicks > 0) Check(a.Advance(0, () => new MatchInput()) <= 8);
            var b = Match(); for (int i = 0; i < 600; i++) b.Step(new MatchInput()); Check(Encode(a.Simulation.State) == Encode(b.State));
        });
        Test("acceleration and 180-degree turn retain momentum instead of teleporting", () => {
            var sim = Match(); Playing(sim); var p = sim.State.Players[sim.State.Controlled]; for (int i = 0; i < 90; i++) sim.Step(new MatchInput { Move = new V2(1,0), Sprint = true }); float before = p.Velocity.X; V2 position = p.Position, facing = p.Facing; sim.Step(new MatchInput { Move = new V2(-1,0) }); Check(p.Velocity.X > 0 && p.Velocity.X <= before + .5f); Check(V2.Distance(position,p.Position) < .2f); Check(V2.Dot(facing,p.Facing) > .9f);
        });
        Test("first touch responds to incoming speed and body angle", () => {
            var p = new PlayerState { Skill = 50, Facing = new V2(0,1) }; var soft = new BallState { Velocity = new V2(0,-8) }; var hard = new BallState { Velocity = new V2(0,30) }; float a = BallPhysics.Receive(soft,p,10), b = BallPhysics.Receive(hard,p,1); Check(b > a); Check(hard.Velocity.Length > soft.Velocity.Length);
        });
        Test("crossbar returns the ball instead of awarding a goal", () => {
            var sim = Match(); Playing(sim); var s = sim.State; s.Ball.Owner = -1; s.Ball.Position = new V2(0,52.3f); s.Ball.Height = 2.44f; s.Ball.Velocity = new V2(0,30); s.Ball.UpVelocity = 0; s.Ball.Kind = FlightKind.Shot; sim.Step(new MatchInput()); Check(s.HomeScore == 0 && s.Ball.Velocity.Z < 0); Check(sim.Events.Any(e=>e.Cue==MatchCue.Woodwork));
        });
        Test("goal restarts the other side at the centre without repeating the goal", () => {
            var sim = Match(); Playing(sim); var s = sim.State; s.Ball.Owner = -1; s.Ball.Position = new V2(0,52.3f); s.Ball.Height = 1; s.Ball.Velocity = new V2(0,30); s.Ball.Kind = FlightKind.Shot; sim.Step(new MatchInput()); Check(s.HomeScore==1 && s.Phase==MatchPhase.GoalScored);
            int announced=sim.Events.Count(e=>e.Cue==MatchCue.Goal); for(int i=0;i<140;i++){sim.Step(new MatchInput());announced+=sim.Events.Count(e=>e.Cue==MatchCue.Goal);} Check(announced==1 && s.KickTeam==1 && s.Phase==MatchPhase.KickOff); Check(s.Ball.Position.Length==0);
        });
        Test("throw in and goal kick always return to playing", () => {
            foreach (bool touchline in new[] {true,false}) { var sim=Match();Playing(sim);var s=sim.State;s.Ball.Owner=-1;s.Ball.Position=touchline?new V2(34.1f,10):new V2(15,52.6f);s.Ball.Velocity=new V2();s.Ball.LastTouchTeam=0;sim.Step(new MatchInput());Check(s.Phase==MatchPhase.ThrowIn||s.Phase==MatchPhase.GoalKick);for(int i=0;i<65;i++)sim.Step(new MatchInput());Check(s.Phase==MatchPhase.Playing); }
        });
        Test("halves last 7200 playing ticks and change ends with a fresh kickoff", () => {
            var sim=Match();Playing(sim);var s=sim.State;s.HalfTicks=7199;s.HalfSeconds=7199/60f;sim.Step(new MatchInput());Check(s.Phase==MatchPhase.HalfTime);for(int i=0;i<301;i++)sim.Step(new MatchInput());Check(s.Half==2&&s.HomeDirection==-1&&s.Phase==MatchPhase.KickOff&&s.KickTeam==1);Playing(sim);s.HalfTicks=7199;sim.Step(new MatchInput());Check(s.Phase==MatchPhase.FullTime);
        });
        Test("training and position affect actual strength, potential caps and insufficient funds are respected", () => { var c=Club();int rating=ClubRules.EffectiveRating(c.Players[0],c.Training);Check(ClubRules.Train(c,0,out _));Check(c.Money==1400&&ClubRules.EffectiveRating(c.Players[0],1)==rating+1);c.Players[0].Potential=rating+1;Check(!ClubRules.Train(c,0,out _));c.Money=0;Check(!ClubRules.Train(c,1,out _)); });
        Test("settlement is idempotent and never rewards an unfinished match", () => { var c=Club();var s=Match().State;Check(!ClubRules.Settle(c,s));s.Phase=MatchPhase.FullTime;s.HomeScore=2;s.AwayScore=1;Check(ClubRules.Settle(c,s));Check(c.Money==1850&&c.Played==1&&c.Wins==1);Check(!ClubRules.Settle(c,s));Check(c.Money==1850); });
        Test("offline reward is bounded to eight hours and backwards time does not earn money", () => {var c=Club();long now=DateTime.UtcNow.Ticks;ClubRules.AccrueIdle(c,now);Check(ClubRules.AccrueIdle(c,now-TimeSpan.TicksPerHour)==0);Check(ClubRules.AccrueIdle(c,now+TimeSpan.TicksPerDay)==86400);});
        Test("save/load restores an active match, preferences and exact future continuation", () => WithStore((store,codec,dir)=>{var save=new SandboxSave{Club=Club()};var sim=Match();for(int i=0;i<200;i++)sim.Step(new MatchInput());save.ActiveMatch=sim.State;save.Preferences.Sound=true;save.Preferences.Splash=false;store.Save(save);Check(store.TryLoad(out var loaded));Check(loaded.Preferences.Sound&&!loaded.Preferences.Splash);var resumed=new MatchSimulation(loaded.ActiveMatch);for(int i=0;i<500;i++){sim.Step(new MatchInput());resumed.Step(new MatchInput());}Check(Encode(sim.State)==Encode(resumed.State));}));
        Test("corrupt newest slot falls back without erasing the older valid save", () => WithStore((store,codec,dir)=>{var save=new SandboxSave{Club=Club()};store.Save(save);save.Club.Money=9999;store.Save(save);File.WriteAllText(Path.Combine(dir,"unity-club-1.json"),"{broken");Check(store.TryLoad(out var loaded));Check(loaded.Club.Money==1500&&store.Warning.Length>0);store.Save(loaded);Check(Directory.GetFiles(dir,"*.corrupt-*").Length==1);}));
        Test("failed serialization does not overwrite either good slot", () => WithStore((store,codec,dir)=>{var save=new SandboxSave{Club=Club()};store.Save(save);string before=File.ReadAllText(Path.Combine(dir,"unity-club-0.json"));codec.Fail=true;Throws(()=>store.Save(save));Check(File.ReadAllText(Path.Combine(dir,"unity-club-0.json"))==before);codec.Fail=false;Check(store.TryLoad(out _));}));
        Test("legacy saves and recordings are rejected rather than silently migrated or overwritten", () => {var save=new SandboxSave{Club=Club(),Namespace="touchline-web"};Check(!SandboxSave.Valid(save));var s=Match().State;s.Rules="motor11-r3";Throws(()=>new MatchSimulation(s));});
        Test("NaN, unknown ball kinds and duplicate players cannot enter saved state", () => {var save=new SandboxSave{Club=Club()};save.Club.Players[1].Id=save.Club.Players[0].Id;Check(!SandboxSave.Valid(save));var sim=Match();sim.State.Ball.Height=float.NaN;Check(!MatchSimulation.Valid(sim.State));});
        Test("asynchronous saves snapshot immutable data and flush the newest queued state", () => WithStore((store,codec,dir)=>{var save=new SandboxSave{Club=Club()};var writer=new SaveWriter(store,codec);for(int i=0;i<30;i++){save.Club.Money=2000+i;writer.Request(save);}save.Club.Money=99999;writer.Flush().GetAwaiter().GetResult();Check(!writer.Busy&&writer.LastError==null);Check(store.TryLoad(out var loaded)&&loaded.Club.Money==2029); }));
        Test("invalid pending snapshots report failure while retaining the last valid save", () => WithStore((store,codec,dir)=>{var save=new SandboxSave{Club=Club()};store.Save(save);var writer=new SaveWriter(store,codec);save.Namespace="wrong-rules";writer.Request(save).GetAwaiter().GetResult();Check(writer.LastError!=null);Check(store.TryLoad(out var old)&&old.Namespace==MatchRules.Version); }));
        Test("a future save version is write protected and never overwritten by this app", () => WithStore((store,codec,dir)=>{Directory.CreateDirectory(dir);string path=Path.Combine(dir,"unity-club-0.json");File.WriteAllText(path,codec.Encode(new SaveEnvelope{Version=2,Revision=100,Payload="future"}));string before=File.ReadAllText(path);Check(!store.TryLoad(out _)&&store.ReadOnly);Throws(()=>store.Save(new SandboxSave{Club=Club()}));Check(File.ReadAllText(path)==before);}));
        Test("invalid teams and nonfinite physics are rejected before a restored match starts", () => {var s=Match().State;s.Players[0].Team=9;Check(!MatchSimulation.Valid(s));s.Players[0].Team=0;s.Ball.UpVelocity=float.PositiveInfinity;Check(!MatchSimulation.Valid(s));});
        Test("loft input creates a real elevated pass with an intended receiver", () => {var sim=Match();Playing(sim);var s=sim.State;int index=s.Controlled;s.Ball.Owner=index;s.Ball.Position=s.Players[index].Position;sim.Step(new MatchInput{Loft=true});Check(s.Ball.Owner<0&&s.Ball.Kind==FlightKind.Loft&&s.Ball.UpVelocity>2.5f&&s.Ball.IntendedReceiver>=0);});
        Test("the short opening pass is received instead of abandoned by its teammate", () => {var sim=Match();Playing(sim);for(int i=0;i<150&&sim.State.Ball.Owner<0;i++)sim.Step(new MatchInput());Check(sim.State.Ball.Owner>=0&&sim.State.Players[sim.State.Ball.Owner].Team==0);Check(sim.State.Controlled==sim.State.Ball.Owner);});
        Test("20 complete varied sandbox matches stay finite and end without deadlock", () => {for(uint seed=1;seed<=20;seed++){var sim=Match(seed);for(int i=0;i<26000&&sim.State.Phase!=MatchPhase.FullTime;i++)sim.Step(new MatchInput{Move=new V2(MathF.Sin(i*.01f),MathF.Cos(i*.013f)),Sprint=i%120<60,Pass=i%71==0,Shoot=i%127==0,ShotPower=.75f,Through=i%97==0,Loft=i%211==0});Check(sim.State.Phase==MatchPhase.FullTime,"stuck seed "+seed);Check(MatchSimulation.Valid(sim.State));foreach(var p in sim.State.Players)Check(p.Position.Finite&&p.Velocity.Finite);}});
        Directory.CreateDirectory("unity/Evidence");File.WriteAllText("unity/Evidence/core-tests.json",JsonSerializer.Serialize(new{passed,failed,unityEditorExecuted=false,physicalAndroidVerified=false,framework=System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription},new JsonSerializerOptions{WriteIndented=true}));Console.WriteLine($"RESULT {passed} passed, {failed} failed");return failed==0?0:1;
    }
    static void WithStore(Action<SaveStore,Codec,string> body) {string dir=Path.Combine(Path.GetTempPath(),"touchline-unity-tests-"+Guid.NewGuid().ToString("N"));var codec=new Codec();try{body(new SaveStore(dir,codec),codec,dir);}finally{if(Directory.Exists(dir))Directory.Delete(dir,true);}}
}
