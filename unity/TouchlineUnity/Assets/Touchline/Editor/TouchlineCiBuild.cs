#if UNITY_EDITOR
using System;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Touchline.Editor
{
    /// <summary>CI-only Android build. No production signing, deployment or data migration.</summary>
    public static class TouchlineCiBuild
    {
        private const string EditorVersion = "6000.6.10f1";
        private const string Branch = "refs/heads/codex/unity-66-foundation";
        private const string AppId = "dk.touchline.footballidle.unitytest";

        public static void BuildAndroid()
        {
            string[] args = Environment.GetCommandLineArgs();
            if (Read(args, "-touchlineBranch") != Branch || Application.unityVersion != EditorVersion)
                throw new InvalidOperationException("CI må kun bygge Unity-branchen med Unity " + EditorVersion + ".");
            if (EditorApplication.isCompiling || EditorApplication.isUpdating)
                throw new InvalidOperationException("Unity-import/kompilering er ikke afsluttet.");

            string buildId = Read(args, "-touchlineBuildId");
            string commit = Read(args, "-touchlineCommit");
            if (!Regex.IsMatch(buildId, @"\A[0-9]+-[0-9]+\z") || !Regex.IsMatch(commit, @"\A[0-9a-f]{40}\z"))
                throw new InvalidDataException("Ugyldigt CI-build-id eller commit.");
            if (!int.TryParse(Read(args, "-touchlineBuildNumber"), NumberStyles.None,
                    CultureInfo.InvariantCulture, out int number) || number < 1 || number > 2000000000)
                throw new InvalidDataException("Ugyldigt Android-versionnummer.");

            string project = Directory.GetParent(Application.dataPath).FullName;
            string keystore = Path.GetFullPath(Path.Combine(project, Read(args, "-touchlineKeystore")));
            string keyName = Path.GetFileName(keystore);
            if ((keyName != "touchline-ci-debug.keystore" && keyName != "touchline-unity-" + buildId + ".keystore") || !File.Exists(keystore))
                throw new FileNotFoundException("Den særskilte Unity-debug-keystore mangler.");

            // A queued first-import setup must not later reset CI version/signing.
            EditorApplication.delayCall -= TouchlineProjectSetup.Ensure;
            TouchlineProjectSetup.Ensure();
            foreach (string model in new[] { "player-auto", "keeper-auto" })
            {
                string controller = "Assets/Touchline/Resources/Touchline/Controllers/" + model + ".controller";
                if (AssetDatabase.LoadAssetAtPath<AnimatorController>(controller) == null)
                    throw new InvalidDataException("Unity-importen mangler spiller-/målmandsanimationer.");
            }
            if (PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android) != AppId)
                throw new InvalidOperationException("Testens app-id er ændret. Build afbrudt.");

            string output = Path.Combine(project, "Builds", "CI", buildId);
            if (Directory.Exists(output))
                throw new IOException("CI-output findes allerede; tidligere artefakter overskrives ikke.");
            Directory.CreateDirectory(output);

            // The password/alias are Android's public development defaults. The
            // randomly generated private key lives ONLY in a dedicated GitHub Secret.
            // Never reuse APK 37's key or the Capacitor test signing identity here.
            try
            {
                PlayerSettings.Android.useCustomKeystore = true;
                PlayerSettings.Android.keystoreName = keystore;
                PlayerSettings.Android.keystorePass = "android";
                PlayerSettings.Android.keyaliasName = "androiddebugkey";
                PlayerSettings.Android.keyaliasPass = "android";
                PlayerSettings.Android.bundleVersionCode = checked(1001 + number);
                PlayerSettings.bundleVersion = "0.1." + number.ToString(CultureInfo.InvariantCulture);
                PlayerSettings.Android.targetSdkVersion = (AndroidSdkVersions)35;
                EditorUserBuildSettings.buildAppBundle = false;
                EditorUserBuildSettings.exportAsGoogleAndroidProject = false;

                var options = new BuildPlayerOptions
                {
                    scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray(),
                    locationPathName = Path.Combine(output, "Touchline-Unity-Test.apk"),
                    target = BuildTarget.Android,
                    options = BuildOptions.Development
                };
                BuildReport report = BuildPipeline.BuildPlayer(options);
                if (report.summary.result != BuildResult.Succeeded || !File.Exists(options.locationPathName))
                    throw new InvalidOperationException("Unity Android-build fejlede: " + report.summary.result);

                var info = new BuildInfo
                {
                    unityVersion = Application.unityVersion, appId = AppId, branch = Branch,
                    commit = commit, buildId = buildId, versionCode = PlayerSettings.Android.bundleVersionCode,
                    version = PlayerSettings.bundleVersion, target = "Android ARM64 IL2CPP",
                    signing = "Dedicated Unity debug key; not production/Capacitor signing",
                    builtUtc = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
                    physicalAndroidTestExecuted = false
                };
                File.WriteAllText(Path.Combine(output, "build-info.json"), JsonUtility.ToJson(info, true));
            }
            finally
            {
                // Do not persist signing secrets into ProjectSettings or a future cache.
                PlayerSettings.Android.keystorePass = "";
                PlayerSettings.Android.keyaliasPass = "";
                PlayerSettings.Android.keystoreName = "";
                PlayerSettings.Android.keyaliasName = "";
                PlayerSettings.Android.useCustomKeystore = false;
            }
        }

        private static string Read(string[] args, string name)
        {
            int index = Array.IndexOf(args, name);
            if (index < 0 || index + 1 >= args.Length || args[index + 1].StartsWith("-", StringComparison.Ordinal))
                throw new InvalidDataException("Build-argument mangler: " + name);
            return args[index + 1];
        }

        [Serializable]
        private sealed class BuildInfo
        {
            public string unityVersion, appId, branch, commit, buildId, version, target, signing, builtUtc;
            public int versionCode;
            public bool physicalAndroidTestExecuted;
        }
    }
}
#endif
