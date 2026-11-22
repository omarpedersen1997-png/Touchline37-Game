using Touchline.Core;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Touchline.Runtime
{
    public sealed class MatchInputRouter
    {
        public Vector2 Thumb;
        public bool SprintHeld, ShootHeld;
        private MatchInput queued;
        private float charge;
        public float Charge => charge;
        public void QueuePass(bool owns) { if (owns) queued.Pass = true; else queued.Switch = true; }
        public void QueueThrough() { queued.Through = true; }
        public void QueueLoft() { queued.Loft = true; }
        public void QueueSkill() { queued.Skill = true; }
        public void ShootDown(bool owns) { if (owns) ShootHeld = true; else queued.Tackle = true; }
        public void ShootUp()
        {
            if (ShootHeld) { queued.Shoot = true; queued.ShotPower = Mathf.Clamp(charge, .2f, 1); }
            ShootHeld = false; charge = 0;
        }
        public void CancelShot() { ShootHeld = false; charge = 0; }
        public void Poll(float seconds, bool owns)
        {
            var keyboard = Keyboard.current;
            if (keyboard != null)
            {
                if (keyboard.eKey.wasPressedThisFrame) QueuePass(owns);
                if (keyboard.rKey.wasPressedThisFrame) QueueThrough();
                if (keyboard.fKey.wasPressedThisFrame) QueueLoft();
                if (keyboard.qKey.wasPressedThisFrame) QueueSkill();
                if (keyboard.spaceKey.wasPressedThisFrame) ShootDown(owns);
                if (keyboard.spaceKey.wasReleasedThisFrame) ShootUp();
            }
            if (ShootHeld) charge = Mathf.Clamp01(charge + seconds / .7f);
        }
        public MatchInput Consume(Camera camera)
        {
            var keyboard = Keyboard.current; Vector2 axis = Thumb;
            if (keyboard != null)
            {
                axis += new Vector2((keyboard.dKey.isPressed || keyboard.rightArrowKey.isPressed ? 1 : 0) - (keyboard.aKey.isPressed || keyboard.leftArrowKey.isPressed ? 1 : 0), (keyboard.wKey.isPressed || keyboard.upArrowKey.isPressed ? 1 : 0) - (keyboard.sKey.isPressed || keyboard.downArrowKey.isPressed ? 1 : 0));
            }
            axis = Vector2.ClampMagnitude(axis, 1);
            Vector3 right = camera.transform.right, forward = camera.transform.forward; right.y = forward.y = 0; right.Normalize(); forward.Normalize();
            Vector3 world = right * axis.x + forward * axis.y;
            MatchInput input = queued; input.Move = new V2(world.x, world.z); input.Sprint = SprintHeld || keyboard != null && (keyboard.leftShiftKey.isPressed || keyboard.rightShiftKey.isPressed);
            queued = new MatchInput(); return input;
        }
        public void Reset() { Thumb = Vector2.zero; SprintHeld = ShootHeld = false; queued = new MatchInput(); charge = 0; }
    }
}
