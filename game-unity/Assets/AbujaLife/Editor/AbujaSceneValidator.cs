#if UNITY_EDITOR
using UnityEditor; using UnityEngine; using AbujaLife.World;
public static class AbujaSceneValidator { [MenuItem("AbujaLife/Validate Open Scenes")] public static void Validate(){int chunks=Object.FindObjectsByType<WorldChunkAnchor>(FindObjectsSortMode.None).Length;int portals=Object.FindObjectsByType<BuildingPortal>(FindObjectsSortMode.None).Length;Debug.Log($"AbujaLife validation: {chunks} world chunks, {portals} building portals. Ensure no exterior scene ships without chunk bounds, navigation and spawn anchors.");} }
#endif
