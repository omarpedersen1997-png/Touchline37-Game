#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.Compilation;
using UnityEngine;

namespace Touchline.Editor
{
    /// <summary>Survives Android target switching and its assembly/domain reload.</summary>
    [InitializeOnLoad]
    public static class TouchlineAndroidBuild
    {
        private const string Pending = "Touchline.AndroidBuild.Pending";
        private const string Switching = "Touchline.AndroidBuild.Switching";
        private const string Diagnostics = "Touchline.AndroidBuild.Diagnostics";
        private const string SwitchStarted = "Touchline.AndroidBuild.SwitchStarted";
        public const string ApkPath = "Builds/Android/Touchline-Unity-Test.apk";
        private static bool building;

        static TouchlineAndroidBuild()
        {
            EditorApplication.update += ContinuePending;
            CompilationPipeline.assemblyCompilationFinished += CaptureCompilerMessages;
        }

        [MenuItem("Touchline/Build Android Test APK")]
        public static void Request()
        {
            if (building || SessionState.GetBool(Pending, false)) return;
            if (Application.unityVersion != "6000.6.10f1")
                throw new InvalidOperationException("Åbn projektet med Unity 6000.6.10f1.");
            if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.Android, BuildTarget.Android))
                throw new InvalidOperationException("Installer Android Build Support med SDK/NDK og OpenJDK til denne editor i Unity Hub.");
            if (EditorApplication.isPlayingOrWillChangePlaymode)
                throw new InvalidOperationException("Afslut Play Mode før APK-bygningen.");

            Directory.CreateDirectory("Builds/Android");
            string log = Path.GetFullPath("Builds/Android/Build-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff") + ".log");
            File.WriteAllText(log, "Touchline Android TEST · Unity " + Application.unityVersion + Environment.NewLine);
            SessionState.SetString(Diagnostics, log);
            SessionState.SetBool(Switching, false);
            SessionState.SetBool(Pending, true);
            Debug.Log("Touchline: APK-build er køsat. Android-import og kompilering afventes automatisk.");
        }

        [MenuItem("Touchline/Build Android Test APK", true)]
        private static bool CanRequest() => !building && !SessionState.GetBool(Pending, false) && !EditorApplication.isPlayingOrWillChangePlaymode;

        private static void ContinuePending()
        {
            if (!SessionState.GetBool(Pending, false) || building || EditorApplication.isCompiling || EditorApplication.isUpdating) return;
            try
            {
                if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android)
                {
                    if (SessionState.GetBool(Switching, false))
                    {
                        if (double.TryParse(SessionState.GetString(SwitchStarted, ""), out double started) && EditorApplication.timeSinceStartup - started > 1800)
                            throw new TimeoutException("Android-targetskiftet blev ikke afsluttet. Se Unity Console.");
                        return;
                    }
                    SessionState.SetBool(Switching, true);
                    SessionState.SetString(SwitchStarted, EditorApplication.timeSinceStartup.ToString());
                    if (!EditorUserBuildSettings.SwitchActiveBuildTargetAsync(BuildTargetGroup.Android, BuildTarget.Android))
                        throw new InvalidOperationException("Unity kunne ikke skifte til Android. Se Console.");
                    return;
                }
                if (EditorUtility.scriptCompilationFailed)
                    throw new InvalidOperationException("C#-kompileringen fejlede. Se Console og build-loggen.");

                building = true;
                SessionState.SetBool(Pending, false);
                TouchlineProjectSetup.Ensure();
                TouchlineProjectSetup.ValidatePreparedProject();
                PlayerSettings.Android.useCustomKeystore = false;
                PlayerSettings.Android.keystoreName = "";
                PlayerSettings.Android.keyaliasName = "";
                PlayerSettings.Android.keystorePass = "";
                PlayerSettings.Android.keyaliasPass = "";
                PlayerSettings.Android.bundleVersionCode = checked(PlayerSettings.Android.bundleVersionCode + 1);
                EditorUserBuildSettings.buildAppBundle = false;
                EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
                ArchivePreviousApk();
                var options = new BuildPlayerOptions
                {
                    scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray(),
                    locationPathName = ApkPath, target = BuildTarget.Android,
                    options = BuildOptions.Development
                };
                BuildReport report = BuildPipeline.BuildPlayer(options);
                string log = SessionState.GetString(Diagnostics, "");
                foreach (var step in report.steps)
                    foreach (var message in step.messages)
                        if (message.type == LogType.Warning || message.type == LogType.Error || message.type == LogType.Exception)
                            File.AppendAllText(log, message.type + ": " + message.content + Environment.NewLine);
                File.AppendAllText(log, "Resultat: " + report.summary.result + "; advarsler: " + report.summary.totalWarnings + "; fejl: " + report.summary.totalErrors + Environment.NewLine);
                if (report.summary.result != BuildResult.Succeeded || !File.Exists(ApkPath))
                    throw new InvalidOperationException("APK-build fejlede. Se " + log);
                AssetDatabase.SaveAssets();
                Debug.Log("Touchline Android TEST er bygget: " + Path.GetFullPath(ApkPath) + "\nKompilerings-/buildadvarsler: " + log);
            }
            catch (Exception error)
            {
                SessionState.SetBool(Pending, false);
                Debug.LogException(error);
            }
            finally { building = false; }
        }

        private static void CaptureCompilerMessages(string assembly, CompilerMessage[] messages)
        {
            if (!SessionState.GetBool(Pending, false)) return;
            string log = SessionState.GetString(Diagnostics, "");
            if (string.IsNullOrEmpty(log)) return;
            foreach (var message in messages)
                File.AppendAllText(log, message.type + ": " + message.file + ":" + message.line + " " + message.message + Environment.NewLine);
        }

        private static void ArchivePreviousApk()
        {
            if (!File.Exists(ApkPath)) return;
            Directory.CreateDirectory("Builds/Android/History");
            string backup = "Builds/Android/History/" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff") + "-Touchline-Unity-Test.apk";
            File.Copy(ApkPath, backup, false);
        }
    }

    /// <summary>Validates the same required assets/settings for menu, CI and Build Profiles.</summary>
    public sealed class TouchlineAndroidPrebuild : IPreprocessBuildWithReport
    {
        public int callbackOrder => -1000;
        public void OnPreprocessBuild(BuildReport report)
        {
            if (report.summary.platform != BuildTarget.Android) return;
            TouchlineProjectSetup.ValidatePreparedProject();
        }
    }
}
#endif
