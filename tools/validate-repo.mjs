import fs from 'node:fs';
const required = [
  'game-unity/Assets/AbujaLife/Scripts/World/WorldStreamManager.cs',
  'game-unity/Assets/AbujaLife/Scripts/Player/ThirdPersonMotor.cs',
  'game-unity/Assets/AbujaLife/Scripts/Vehicles/VehicleController.cs',
  'services/core/src/server.js',
  'data/abuja/districts.json',
  'docs/ABUJA_WORLD_BIBLE.md'
];
for (const f of required) if (!fs.existsSync(f)) throw new Error(`Missing ${f}`);
const districts = JSON.parse(fs.readFileSync('data/abuja/districts.json','utf8'));
if (districts.length < 8) throw new Error('Abuja district catalog is incomplete');
if (fs.existsSync('apps/web-prototype')) throw new Error('Rejected toy prototype leaked into premium repo');
console.log(`Repo validation passed: ${required.length} critical files, ${districts.length} districts.`);
