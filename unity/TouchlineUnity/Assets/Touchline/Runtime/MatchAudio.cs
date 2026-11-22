using System.Collections;
using System.Collections.Generic;
using Touchline.Core;
using UnityEngine;

namespace Touchline.Runtime
{
    public sealed class MatchAudio : MonoBehaviour
    {
        private readonly Dictionary<string,AudioClip> clips=new Dictionary<string,AudioClip>();
        private readonly HashSet<string> loading=new HashSet<string>();
        private readonly AudioSource[] voices=new AudioSource[8];
        private bool soundEnabled,paused,inMatch;
        private int generation;
        public void Initialize(bool enabled)
        {
            soundEnabled=enabled;for(int i=0;i<voices.Length;i++){voices[i]=gameObject.AddComponent<AudioSource>();voices[i].playOnAwake=false;voices[i].spatialBlend=0;voices[i].priority=i==0?180:100;}
        }
        public void SetEnabled(bool value){soundEnabled=value;generation++;if(!value)Stop();else Ambient();}
        public void SetPaused(bool value){paused=value;generation++;if(value)Stop();else Ambient();}
        public void SetMatch(bool value){inMatch=value;generation++;if(!value)Stop();else Ambient();}
        private bool Allowed=>soundEnabled&&!paused&&inMatch;
        private void Stop(){StopAllCoroutines();loading.Clear();foreach(var voice in voices)if(voice!=null)voice.Stop();}
        public IEnumerator Prepare()
        {
            foreach(string name in new[]{"ambience","kick-soft","kick-hard","whistle","crowd-goal","crowd-chance","woodwork","net"})
            {
                if(clips.ContainsKey(name))continue;var request=Resources.LoadAsync<AudioClip>("Touchline/Audio/"+name);yield return request;if(request.asset is AudioClip clip)clips[name]=clip;
            }
        }
        private void Ambient(){if(Allowed&&!voices[0].isPlaying&&clips.TryGetValue("ambience",out var clip)){voices[0].clip=clip;voices[0].volume=.12f;voices[0].loop=true;voices[0].Play();}}
        private void Play(string name,float volume=.4f)
        {
            if(!Allowed)return;
            if(!clips.TryGetValue(name,out var clip)){if(!loading.Contains(name))StartCoroutine(LoadAndPlay(name,volume,generation));return;}
            for(int i=1;i<voices.Length;i++)if(!voices[i].isPlaying){voices[i].loop=false;voices[i].clip=clip;voices[i].volume=volume;voices[i].Play();return;}
        }
        private IEnumerator LoadAndPlay(string name,float volume,int epoch)
        {
            loading.Add(name);float at=Time.realtimeSinceStartup;var request=Resources.LoadAsync<AudioClip>("Touchline/Audio/"+name);yield return request;loading.Remove(name);
            if(request.asset is AudioClip clip)clips[name]=clip;
            if(epoch==generation&&Allowed&&Time.realtimeSinceStartup-at<.3f)Play(name,volume);
        }
        private IEnumerator Whistles(int count,int epoch)
        {
            for(int i=0;i<count;i++){if(epoch!=generation||!Allowed)yield break;Play("whistle",.35f);if(i+1<count)yield return new WaitForSecondsRealtime(.38f);}
        }
        public void Event(MatchEvent e)
        {
            if(!Allowed)return;
            switch(e.Cue)
            {
                case MatchCue.KickOff:StartCoroutine(Whistles(1,generation));break;
                case MatchCue.HalfTime:StartCoroutine(Whistles(2,generation));break;
                case MatchCue.FullTime:StartCoroutine(Whistles(3,generation));break;
                case MatchCue.Pass:case MatchCue.Shot:Play(e.Strength>.65f?"kick-hard":"kick-soft",.6f);break;
                case MatchCue.Receive:Play("kick-soft",.13f);break;
                case MatchCue.Save:Play("kick-soft",.2f);Play("crowd-chance",.2f);break;
                case MatchCue.Woodwork:Play("woodwork",.5f);Play("crowd-chance",.25f);break;
                case MatchCue.Goal:Play("net",.5f);Play("crowd-goal",.35f);break;
            }
        }
        private void OnDestroy(){generation++;Stop();clips.Clear();}
    }
}
