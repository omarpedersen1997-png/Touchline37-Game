using Touchline.Core;
using UnityEngine;

namespace Touchline.Runtime
{
    public sealed class BroadcastCamera
    {
        private readonly Camera camera;
        private Vector3 eyeVelocity,targetVelocity,look;
        private bool initialized;
        public BroadcastCamera(Camera camera){this.camera=camera;}
        public void Reset(){initialized=false;eyeVelocity=targetVelocity=Vector3.zero;}
        public void Present(MatchState state,Vector3 shownBall,bool reducedMotion)
        {
            var p=state.Players[state.Controlled];Vector3 player=new Vector3(p.Position.X,.5f,p.Position.Z);
            bool kickoff=state.Phase==MatchPhase.KickOff;Vector3 lead=reducedMotion||kickoff?Vector3.zero:new Vector3(state.Ball.Velocity.X,0,state.Ball.Velocity.Z)*.08f;
            lead=Vector3.ClampMagnitude(lead,2.5f);Vector3 target=kickoff?new Vector3(0,.8f,0):shownBall+Vector3.ClampMagnitude(player-shownBall,9)*.12f+lead;
            target.x=Mathf.Clamp(target.x,-29,29);target.z=Mathf.Clamp(target.z,-46,46);target.y=Mathf.Clamp(target.y,.75f,3.2f);
            float portraitFit=Mathf.Max(1,Mathf.Sqrt(1.6f/Mathf.Max(.5f,camera.aspect))),framing=reducedMotion?1:1+Mathf.Clamp(shownBall.y*.015f,0,.1f);
            Vector3 eye=target+new Vector3(18.5f,12,-7)*portraitFit*framing;
            float dt=Mathf.Min(.05f,Time.unscaledDeltaTime),smooth=reducedMotion?.22f:.12f;
            if(!initialized){camera.transform.position=eye;look=target;initialized=true;}
            else{camera.transform.position=Vector3.SmoothDamp(camera.transform.position,eye,ref eyeVelocity,smooth,150,dt);look=Vector3.SmoothDamp(look,target,ref targetVelocity,smooth,150,dt);}
            camera.fieldOfView=43;camera.transform.LookAt(look);
        }
    }
}
