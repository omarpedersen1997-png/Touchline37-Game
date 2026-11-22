#if UNITY_EDITOR
using System;
using UnityEditor;
using UnityEngine;

namespace Touchline.Editor
{
    public sealed class TouchlineAssetImporter : AssetPostprocessor
    {
        private bool Ours=>assetPath.StartsWith("Assets/Touchline/Resources/Touchline/",StringComparison.Ordinal);
        private void OnPreprocessModel()
        {
            if(!Ours)return;var importer=(ModelImporter)assetImporter;bool player=assetPath.Contains("player-")||assetPath.Contains("keeper-");
            importer.globalScale=1;importer.useFileScale=true;importer.importCameras=false;importer.importLights=false;importer.importBlendShapes=true;importer.importAnimation=player;
            importer.animationType=player?ModelImporterAnimationType.Generic:ModelImporterAnimationType.None;
            importer.optimizeGameObjects=false; // Named bones remain available for labels/grounding.
            importer.importNormals=ModelImporterNormals.Import;importer.importTangents=ModelImporterTangents.CalculateMikk;
            importer.animationCompression=ModelImporterAnimationCompression.Optimal;
        }
        private void OnPreprocessAnimation()
        {
            if(!Ours)return;var importer=(ModelImporter)assetImporter;var clips=importer.defaultClipAnimations;
            foreach(var clip in clips)
            {
                string n=clip.name.ToLowerInvariant();clip.loopTime=n.Contains("idle")||n.Contains("walk")||n.Contains("run")||n.Contains("sprint")||n.Contains("strafe");
                clip.lockRootRotation=true;clip.lockRootPositionXZ=true;
            }
            importer.clipAnimations=clips;
        }
        private void OnPreprocessTexture()
        {
            if(!Ours)return;var importer=(TextureImporter)assetImporter;bool normal=assetPath.Contains("normal");bool data=normal||assetPath.Contains("roughness");
            importer.textureType=normal?TextureImporterType.NormalMap:TextureImporterType.Default;importer.sRGBTexture=!data;importer.mipmapEnabled=true;importer.isReadable=false;importer.wrapMode=TextureWrapMode.Repeat;importer.anisoLevel=4;importer.maxTextureSize=8192;
            // Keep the actual authored resolution; there is no APK-size guard.
            importer.textureCompression=TextureImporterCompression.CompressedHQ;
        }
        private void OnPreprocessAudio()
        {
            if(!Ours)return;var importer=(AudioImporter)assetImporter;var settings=importer.defaultSampleSettings;
            settings.compressionFormat=AudioCompressionFormat.Vorbis;settings.quality=.85f;
            settings.loadType=assetPath.EndsWith("ambience.wav",StringComparison.Ordinal)?AudioClipLoadType.Streaming:AudioClipLoadType.CompressedInMemory;
            importer.defaultSampleSettings=settings;importer.preloadAudioData=false;importer.loadInBackground=true;
        }
    }
}
#endif
