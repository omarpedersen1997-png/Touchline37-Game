using Touchline.Core;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Touchline.Runtime
{
    public sealed class PlayerView : MonoBehaviour
    {
        private Transform visual, leftToe, rightToe;
        private Animator animator;
        private string lastClip = "";
        private float motionScale = 1;
        private readonly Dictionary<string,float> lengths = new Dictionary<string,float>();
        private Vector3 baseOffset;
        private TextMesh focusLabel;
        private LineRenderer ring;
        public bool HasImportedModel { get; private set; }
        public void Initialize(PlayerState player, FootballWorld world)
        {
            string name = player.Keeper ? "keeper-auto" : "player-auto";
            GameObject source = Resources.Load<GameObject>("Touchline/Models/" + name);
            GameObject body = source != null ? Instantiate(source, transform) : GameObject.CreatePrimitive(PrimitiveType.Capsule);
            if (source == null) { body.transform.SetParent(transform, false); body.transform.localScale = new Vector3(.58f, .9f, .38f); body.transform.localPosition = new Vector3(0, .9f, 0); }
            HasImportedModel = source != null; visual = body.transform;
            var renderers = body.GetComponentsInChildren<Renderer>();
            if (source != null && renderers.Length > 0)
            {
                Bounds bounds = renderers[0].bounds; foreach (var r in renderers) bounds.Encapsulate(r.bounds);
                if (bounds.size.y > .1f) { motionScale = 1.82f / bounds.size.y; visual.localScale *= motionScale; }
                baseOffset = new Vector3(0, -.01f - bounds.min.y * (1.82f / Mathf.Max(.1f, bounds.size.y)), 0); visual.localPosition = baseOffset;
            }
            foreach (var renderer in renderers)
            {
                var materials = renderer.sharedMaterials;
                for (int i = 0; i < materials.Length; i++) materials[i] = world.PlayerMaterial(materials[i], player);
                renderer.sharedMaterials = materials; renderer.shadowCastingMode = ShadowCastingMode.On;
            }
            animator = body.GetComponentInChildren<Animator>();
            if (source != null)
            {
                if (animator == null) animator = body.AddComponent<Animator>();
                animator.runtimeAnimatorController = Resources.Load<RuntimeAnimatorController>("Touchline/Controllers/" + name);
                animator.applyRootMotion = false; animator.cullingMode = AnimatorCullingMode.CullUpdateTransforms;
                if (animator.runtimeAnimatorController != null)
                {
                    foreach (var clip in animator.runtimeAnimatorController.animationClips)
                        foreach (string key in new[]{"idle","walk","run","sprint","pass","shoot","turn","tackle","dive","cheer"})
                            if (clip.name.IndexOf(key,System.StringComparison.OrdinalIgnoreCase)>=0) lengths[key]=clip.length;
                    animator.Play("idle", 0, (player.Number * .137f) % 1);
                }
                leftToe = Find(body.transform, "LeftToeBase"); rightToe = Find(body.transform, "RightToeBase");
                AddBackNumber(player);
            }
            var label = new GameObject("Aktiv spiller"); label.transform.SetParent(transform, false); label.transform.localPosition = Vector3.up * 2.15f;
            focusLabel = label.AddComponent<TextMesh>(); focusLabel.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); focusLabel.fontSize = 60; focusLabel.characterSize = .022f; focusLabel.anchor = TextAnchor.MiddleCenter; focusLabel.color = new Color(.95f, 1, .87f);
            focusLabel.text = player.Number + " · " + player.Name.Substring(player.Name.LastIndexOf(' ') + 1);
            label.GetComponent<MeshRenderer>().sharedMaterial = focusLabel.font.material;
            var circle = new GameObject("Fokusmarkør"); circle.transform.SetParent(transform, false); circle.transform.localPosition = Vector3.up * .04f;
            ring = circle.AddComponent<LineRenderer>(); ring.sharedMaterial = world.Material("Lime"); ring.useWorldSpace = false; ring.loop = true; ring.widthMultiplier = .045f; ring.positionCount = 40;
            for (int i = 0; i < 40; i++) { float angle = i * Mathf.PI * 2 / 40; ring.SetPosition(i, new Vector3(Mathf.Cos(angle) * .6f, 0, Mathf.Sin(angle) * .6f)); }
        }
        internal static Transform Find(Transform root, string name)
        {
            foreach (var node in root.GetComponentsInChildren<Transform>(true)) if (node.name == name) return node;
            return null;
        }
        private void AddBackNumber(PlayerState player)
        {
            var chest = Find(visual, "Spine2"); if (chest == null) return;
            var label = new GameObject("Rygnummer " + player.Number); label.transform.SetParent(chest, false);
            Vector3 point = transform.TransformPoint(new Vector3(0, 1.42f, -.19f));
            label.transform.position = point; label.transform.rotation = transform.rotation * Quaternion.Euler(0, 180, 0);
            var text = label.AddComponent<TextMesh>(); text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); text.fontSize = 80; text.characterSize = .035f; text.anchor = TextAnchor.MiddleCenter; text.text = player.Number.ToString(); text.color = Color.white; label.GetComponent<MeshRenderer>().sharedMaterial = text.font.material;
        }
        public void Present(PlayerState p, float alpha, bool focused, Camera camera, bool frozen = false)
        {
            V2 position = V2.Lerp(p.PreviousPosition, p.Position, alpha);
            transform.position = new Vector3(position.X, .025f, position.Z);
            V2 facing = V2.Lerp(p.PreviousFacing, p.Facing, alpha).Normalized;
            if (facing.Length > .1f) transform.rotation = Quaternion.LookRotation(new Vector3(facing.X, 0, facing.Z));
            float speed = p.Velocity.Length;
            string clip = p.ActionRemaining > 0 ? p.Action == PlayerAction.Shoot ? "shoot" : p.Action == PlayerAction.Pass ? "pass" : p.Action == PlayerAction.Tackle ? "tackle" : p.Action == PlayerAction.Dive ? "dive" : p.Action == PlayerAction.Cheer ? "cheer" : "turn" : speed > 7.3f ? "sprint" : speed > 3.7f ? "run" : speed > .2f ? "walk" : "idle";
            if (animator != null && animator.runtimeAnimatorController != null)
            {
                if (lastClip != clip)
                {
                    float length = lengths.TryGetValue(clip,out var duration) ? duration : 1;
                    // Ball release occurs at contact, not at the clip's wind-up.
                    // Running transitions retain cycle phase instead of restarting
                    // both boots on every walk/run/sprint boundary.
                    float offset = clip=="pass"||clip=="shoot" ? length*.45f : p.ActionRemaining<=0 ? (animator.GetCurrentAnimatorStateInfo(0).normalizedTime%1)*length : 0;
                    animator.CrossFadeInFixedTime(clip,p.ActionRemaining>0?.055f:.1f,0,offset);lastClip=clip;
                }
                float reference=(clip=="sprint"?4.27f:clip=="run"?3.5f:1.42f)*motionScale;
                animator.speed = frozen ? 0 : p.ActionRemaining > 0 || speed < .2f ? 1 : Mathf.Clamp(speed/reference,.2f,2.6f);
            }
            Vector3 localAcceleration = transform.InverseTransformDirection(new Vector3(p.Acceleration.X, 0, p.Acceleration.Z));
            float roll = 0, lift = 0;
            if (p.Action == PlayerAction.Dive && p.ActionRemaining > 0) { float phase = Mathf.Sin((1 - p.ActionRemaining / .7f) * Mathf.PI); roll = -70 * phase; lift = .95f * (1 - Mathf.Cos(roll * Mathf.Deg2Rad)); }
            visual.localRotation = Quaternion.Slerp(visual.localRotation, Quaternion.Euler(Mathf.Clamp(localAcceleration.z * .35f, -5, 6), 0, roll + Mathf.Clamp(-localAcceleration.x * .4f, -7, 7)), 1 - Mathf.Exp(-18 * Time.unscaledDeltaTime));
            visual.localPosition = baseOffset + Vector3.up * lift;
            focusLabel.gameObject.SetActive(focused); ring.gameObject.SetActive(focused);
            if (focused) focusLabel.transform.rotation = camera.transform.rotation;
        }
        public void GroundFeet()
        {
            if (leftToe == null || rightToe == null || Mathf.Abs(visual.localEulerAngles.z) > 20 && Mathf.Abs(visual.localEulerAngles.z) < 340) return;
            float lowest = Mathf.Min(leftToe.position.y, rightToe.position.y) - .045f;
            visual.position += Vector3.up * Mathf.Clamp(.03f - lowest, -.12f, .12f);
        }
    }
}
