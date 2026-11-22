using System.Collections.Generic;
using Touchline.Core;
using UnityEngine;
using UnityEngine.Rendering;

namespace Touchline.Runtime
{
    public sealed class FootballWorld
    {
        public readonly GameObject Root;
        public Transform Ball { get; private set; }
        public int FallbackPlayers { get; private set; }
        private readonly Dictionary<string, Material> materials = new Dictionary<string, Material>();
        private PlayerView[] players;
        private GameObject stadium;
        private Transform netHome, netAway;
        private float netImpulse;
        private int struckNet;
        private Vector3 lastBall;
        private bool ballInitialized;
        public FootballWorld(Transform parent)
        {
            Root = new GameObject("Touchline · kampverden"); Root.transform.SetParent(parent, false);
            BuildPitch(); BuildStadium(); Root.SetActive(false);
        }
        public Material Material(string name)
        {
            if (materials.TryGetValue(name, out var cached)) return cached;
            var source = Resources.Load<Material>("Touchline/Materials/" + name);
            var material = source != null ? new Material(source) : new Material(Shader.Find("Universal Render Pipeline/Lit"));
            material.enableInstancing = true; materials[name] = material; return material;
        }
        public Material PlayerMaterial(Material original, PlayerState p)
        {
            string name = original != null ? original.name : "", lower = name.ToLowerInvariant();
            if (lower.Contains("shirt")) return Material(p.Keeper ? "Keeper" : p.Team == 0 ? "Home" : "Away");
            if (lower.Contains("short")) return Material("Shorts");
            if (lower.Contains("sock")) return Material(p.Team == 0 ? "Home" : "Away");
            if (lower.Contains("sneaker") || lower.Contains("boot")) return Material("Boots");
            if (lower.Contains("glove")) return Material("White");
            if (lower.EndsWith("skin"))
            {
                string key = "Skin-" + p.Number % 4;
                if (!materials.ContainsKey(key)) { var m = new Material(Material("Skin")); m.color = new[] {new Color(.65f,.43f,.3f),new Color(.89f,.72f,.56f),new Color(.35f,.23f,.17f),new Color(.75f,.57f,.43f)}[p.Number % 4]; materials[key] = m; }
                return materials[key];
            }
            string sourceKey = "Imported-" + name;
            if (!materials.ContainsKey(sourceKey)) { var m = new Material(Material("Structure")); if (original != null && original.HasProperty("_Color")) m.color = original.color; materials[sourceKey] = m; }
            return materials[sourceKey];
        }
        private GameObject Primitive(PrimitiveType type, string name, Vector3 position, Vector3 scale, Material material)
        {
            var go = GameObject.CreatePrimitive(type); go.name = name; go.transform.SetParent(Root.transform, false); go.transform.localPosition = position; go.transform.localScale = scale;
            go.GetComponent<Renderer>().sharedMaterial = material; var collider = go.GetComponent<Collider>(); if (collider != null) { collider.enabled = false; Object.Destroy(collider); } return go;
        }
        private void Line(string name, params Vector3[] points)
        {
            var go = new GameObject(name); go.transform.SetParent(Root.transform, false); var line = go.AddComponent<LineRenderer>(); line.sharedMaterial = Material("White"); line.positionCount = points.Length; line.widthMultiplier = .12f; line.useWorldSpace = false; line.SetPositions(points); line.shadowCastingMode = ShadowCastingMode.Off; line.receiveShadows = false;
        }
        private void BuildPitch()
        {
            var grass = Primitive(PrimitiveType.Plane,"Græstæppe",Vector3.zero,new Vector3(6.8f,1,10.5f),Material("Grass")); grass.GetComponent<Renderer>().receiveShadows = true;
            Primitive(PrimitiveType.Plane,"Stadionbund",new Vector3(0,-.025f,0),new Vector3(15,1,18),Material("Surround"));
            const float y = .018f, w = 34, l = 52.5f;
            Line("Sidelinjer",new Vector3(-w,y,-l),new Vector3(w,y,-l),new Vector3(w,y,l),new Vector3(-w,y,l),new Vector3(-w,y,-l));
            Line("Midterlinje",new Vector3(-w,y,0),new Vector3(w,y,0));
            var circle = new Vector3[97]; for (int i=0;i<circle.Length;i++) { float a=i*Mathf.PI*2/(circle.Length-1); circle[i]=new Vector3(Mathf.Cos(a)*9.15f,y,Mathf.Sin(a)*9.15f); } Line("Midtercirkel",circle);
            for (int sign=-1;sign<=1;sign+=2)
            {
                Line("Straffelt",new Vector3(-20.16f,y,sign*l),new Vector3(-20.16f,y,sign*(l-16.5f)),new Vector3(20.16f,y,sign*(l-16.5f)),new Vector3(20.16f,y,sign*l));
                Line("Målfelt",new Vector3(-9.16f,y,sign*l),new Vector3(-9.16f,y,sign*(l-5.5f)),new Vector3(9.16f,y,sign*(l-5.5f)),new Vector3(9.16f,y,sign*l));
                var spot=Primitive(PrimitiveType.Cylinder,"Straffeplet",new Vector3(0,.012f,sign*(l-11)),new Vector3(.22f,.008f,.22f),Material("White"));spot.GetComponent<Renderer>().shadowCastingMode=ShadowCastingMode.Off;
            }
            Primitive(PrimitiveType.Cylinder,"Midterplet",new Vector3(0,.012f,0),new Vector3(.22f,.008f,.22f),Material("White"));
        }
        private Transform Part(string name, Vector3 position, float yaw=0)
        {
            if (stadium == null) return null; var original=PlayerView.Find(stadium.transform,name); if(original==null)return null;
            var anchor=new GameObject(name);anchor.transform.SetParent(Root.transform,false);anchor.transform.localPosition=position;anchor.transform.localRotation=Quaternion.Euler(0,yaw,0);
            var clone=Object.Instantiate(original.gameObject,anchor.transform);clone.transform.localPosition=original.position;clone.transform.localRotation=original.rotation;clone.transform.localScale=original.lossyScale;
            foreach(var renderer in clone.GetComponentsInChildren<Renderer>()) {var ms=renderer.sharedMaterials;for(int i=0;i<ms.Length;i++){string key="Stadium-"+(ms[i]!=null?ms[i].name:"default");if(!materials.ContainsKey(key)){var m=new Material(Material("Structure"));if(ms[i]!=null&&ms[i].HasProperty("_Color"))m.color=ms[i].color;materials[key]=m;}ms[i]=materials[key];}renderer.sharedMaterials=ms;renderer.shadowCastingMode=ShadowCastingMode.Off;}
            return anchor.transform;
        }
        private void BuildStadium()
        {
            stadium=Resources.Load<GameObject>("Touchline/Models/stadium-kit");
            for(int sign=-1;sign<=1;sign+=2)
            {
                for(int x=-24;x<=24;x+=12)Part("stand-low",new Vector3(x,0,sign*61),sign<0?0:180);
                // Far-side stands keep the broadcast camera's near side open.
                if(sign<0)for(int z=-42;z<=42;z+=14)Part("stand-low",new Vector3(-42,0,z),90);
                for(int side=-1;side<=1;side+=2){Part("flag",new Vector3(side*34,0,sign*52.5f));Part("floodlight",new Vector3(side*49,0,sign*66),side<0?90:-90);}
                Part("goal",new Vector3(0,0,sign*52.5f),sign>0?180:0);var net=Part("net",new Vector3(0,0,sign*52.5f),sign>0?180:0);if(sign>0)netAway=net;else netHome=net;
                Part("bench",new Vector3(-39,0,sign*15),90);
            }
            Ball=new GameObject("Bold").transform;Ball.SetParent(Root.transform,false);var model=Part("ball",Vector3.zero);
            if(model!=null){model.SetParent(Ball,false);model.localScale=Vector3.one*(.11f/.19f);}else {var sphere=Primitive(PrimitiveType.Sphere,"Boldreserve",Vector3.zero,Vector3.one*.22f,Material("White"));sphere.transform.SetParent(Ball,false);}
        }
        public void Start(MatchState state)
        {
            if(players!=null)foreach(var view in players)Object.Destroy(view.gameObject);
            players=new PlayerView[22];FallbackPlayers=0;for(int i=0;i<22;i++){var go=new GameObject(state.Players[i].Name);go.transform.SetParent(Root.transform,false);players[i]=go.AddComponent<PlayerView>();players[i].Initialize(state.Players[i],this);if(!players[i].HasImportedModel)FallbackPlayers++;}
            ballInitialized=false;Root.SetActive(true);
        }
        public void Event(MatchEvent e,MatchState state)
        {
            if(e.Cue==MatchCue.Goal){struckNet=e.Team==0?state.HomeDirection:-state.HomeDirection;netImpulse=1;}
        }
        public Vector3 Present(MatchState state,float alpha,Camera camera,bool frozen=false)
        {
            for(int i=0;i<players.Length;i++) {players[i].Present(state.Players[i],alpha,i==state.Controlled,camera,frozen);players[i].GroundFeet();}
            V2 point=V2.Lerp(state.Ball.PreviousPosition,state.Ball.Position,alpha);float height=Mathf.Lerp(state.Ball.PreviousHeight,state.Ball.Height,alpha);Vector3 shown=new Vector3(point.X,Mathf.Max(.11f,height),point.Z);
            Ball.position=shown;if(ballInitialized){Vector3 delta=shown-lastBall;Vector3 axis=Vector3.Cross(Vector3.up,delta);if(axis.sqrMagnitude>.000001f)Ball.Rotate(axis.normalized,delta.magnitude/.11f*Mathf.Rad2Deg,Space.World);}lastBall=shown;ballInitialized=true;
            netImpulse=Mathf.Max(0,netImpulse-Time.unscaledDeltaTime*1.5f);Transform net=struckNet>0?netAway:netHome;if(net!=null)net.localScale=new Vector3(1,1,1+Mathf.Sin((1-netImpulse)*18)*netImpulse*.04f);
            return shown;
        }
        public void Dispose(){foreach(var m in materials.Values)Object.Destroy(m);materials.Clear();Object.Destroy(Root);}
    }
}
