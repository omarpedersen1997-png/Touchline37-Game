using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace Touchline.Core
{
    [Serializable]
    public sealed class UserPreferences
    {
        public bool Sound, Splash = true, ReducedMotion;
        public int TargetFps = 60;
    }
    [Serializable]
    public sealed class SandboxSave
    {
        public int SchemaVersion = 1;
        public string Namespace = MatchRules.Version;
        public ClubProfile Club = new ClubProfile();
        public UserPreferences Preferences = new UserPreferences();
        public MatchState ActiveMatch;
        public static bool Valid(SandboxSave s)
        {
            if (s == null || s.SchemaVersion != 1 || s.Namespace != MatchRules.Version || s.Club == null || s.Preferences == null || s.Club.Players == null || s.Club.Players.Count < 11 || s.Club.SettledMatches == null || s.Club.Money < 0 || string.IsNullOrWhiteSpace(s.Club.Name)) return false;
            if (Array.IndexOf(ClubRules.Formations, s.Club.Formation) < 0 || s.Club.Training < 1 || (double.IsNaN(s.Club.IncomeRemainder) || double.IsInfinity(s.Club.IncomeRemainder))) return false;
            var ids = new System.Collections.Generic.HashSet<string>();
            foreach (var p in s.Club.Players)
                if (p == null || string.IsNullOrEmpty(p.Id) || !ids.Add(p.Id) || p.Rating < 1 || p.Rating > 99 || p.Potential < 1 || p.Potential > 99 || p.Development < 0 || !Math2.Finite(p.Energy) || !Math2.Finite(p.Form)) return false;
            if (s.Preferences.TargetFps != 60 && s.Preferences.TargetFps != 120) return false;
            return s.ActiveMatch == null || MatchSimulation.Valid(s.ActiveMatch);
        }
    }
    public interface ITextCodec
    {
        string Encode<T>(T data) where T : class;
        T Decode<T>(string data) where T : class;
    }
    [Serializable]
    public sealed class SaveEnvelope
    {
        public int Version = 1;
        public long Revision;
        public string Payload = "", Sha256 = "";
    }
    public sealed class SaveStore
    {
        private readonly string directory;
        private readonly ITextCodec codec;
        public string Warning { get; private set; } = "";
        public bool ReadOnly { get; private set; }
        public SaveStore(string directory, ITextCodec codec) { this.directory = Path.GetFullPath(directory); this.codec = codec; }
        private string Slot(int index) => Path.Combine(directory, "unity-club-" + index + ".json");
        private static string Digest(string data)
        {
            using (var hash = SHA256.Create())
            {
                var bytes = hash.ComputeHash(Encoding.UTF8.GetBytes(data)); var hex = new StringBuilder(64);
                foreach (byte b in bytes) hex.Append(b.ToString("x2")); return hex.ToString();
            }
        }
        private bool Read(int index, out SaveEnvelope envelope, out SandboxSave save)
        {
            envelope = null; save = null;
            try
            {
                if (!File.Exists(Slot(index))) return false;
                var info = new FileInfo(Slot(index)); if (info.Length > 16 * 1024 * 1024) return false; // Corrupt-input guard, not an asset budget.
                envelope = codec.Decode<SaveEnvelope>(File.ReadAllText(Slot(index), Encoding.UTF8));
                if (envelope != null && envelope.Version > 1) ReadOnly = true;
                if (envelope == null || envelope.Version != 1 || envelope.Revision < 1 || envelope.Payload == null || Digest(envelope.Payload) != envelope.Sha256) return false;
                save = codec.Decode<SandboxSave>(envelope.Payload); if (save != null && save.SchemaVersion > 1) ReadOnly = true; return SandboxSave.Valid(save);
            }
            catch { return false; }
        }
        public bool TryLoad(out SandboxSave save)
        {
            bool a = Read(0, out var first, out var firstSave), b = Read(1, out var second, out var secondSave);
            if (!a && !b) { save = null; Warning = ReadOnly ? "Gemningen kræver en nyere Unity-app. Ingen eksisterende filer må overskrives." : File.Exists(Slot(0)) || File.Exists(Slot(1)) ? "Gemte Unity-data kunne ikke læses. Originalfilerne er bevaret." : ""; return false; }
            save = a && (!b || first.Revision >= second.Revision) ? firstSave : secondSave;
            Warning = ReadOnly ? "En nyere Unity-gemning findes. Klubben åbnes skrivebeskyttet." : (!a && File.Exists(Slot(0))) || (!b && File.Exists(Slot(1))) ? "Klubben er gendannet fra den intakte Unity-sikkerhedskopi." : ""; return true;
        }
        public void Save(SandboxSave save)
        {
            if (ReadOnly) throw new InvalidDataException("Gemningen kræver en nyere Unity-app. Der skrives ingen filer.");
            if (!SandboxSave.Valid(save)) throw new InvalidDataException("Unity-data er ugyldige; eksisterende gemninger er ikke ændret.");
            Directory.CreateDirectory(directory);
            bool a = Read(0, out var first, out _), b = Read(1, out var second, out _);
            if (ReadOnly) throw new InvalidDataException("En nyere gemmeversion blev fundet. Der skrives ingen filer.");
            long revision = checked(Math.Max(a ? first.Revision : 0, b ? second.Revision : 0) + 1);
            int target = !a ? 0 : !b ? 1 : first.Revision <= second.Revision ? 0 : 1;
            string payload = codec.Encode(save), json = codec.Encode(new SaveEnvelope { Revision = revision, Payload = payload, Sha256 = Digest(payload) });
            string destination = Slot(target), temporary = destination + ".tmp";
            using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None))
            { byte[] data = Encoding.UTF8.GetBytes(json); stream.Write(data, 0, data.Length); stream.Flush(true); }
            if (File.Exists(destination))
            {
                // Retain unreadable evidence before replacing this ONE slot.
                if (!(target == 0 ? a : b)) File.Copy(destination, destination + ".corrupt-" + Guid.NewGuid().ToString("N"));
                try { File.Replace(temporary, destination, null); return; }
                catch (PlatformNotSupportedException) { }
                catch (IOException) { }
                // The other valid slot is untouched throughout this fallback.
                string prior = destination + ".previous";
                if (File.Exists(prior)) File.Delete(prior);
                File.Move(destination, prior);
            }
            File.Move(temporary, destination);
        }
        public string Export(SandboxSave save)
        {
            if (!SandboxSave.Valid(save)) throw new InvalidDataException("Unity-data er ugyldige.");
            string payload = codec.Encode(save); return codec.Encode(new SaveEnvelope { Revision = 1, Payload = payload, Sha256 = Digest(payload) });
        }
    }
}
