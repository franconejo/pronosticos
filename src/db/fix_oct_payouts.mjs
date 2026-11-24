import { writeFileSync } from 'fs';
const users = [
  ['6fbd2bc1-b7ac-4d19-b550-35b3fa1ec908',24,4,0,80000],
  ['b1f95c6e-9c40-49db-8909-ebef8f906392',21,3,1,50000],
  ['a59f7d14-b4b7-4621-bc26-1162713207df',19,3,0,30000],
  ['44f98f89-d628-432c-aa61-f72efec1d2a8',18,2,2,0],
  ['39e643a5-9957-41dd-b008-be4b0c6dc144',18,2,2,0],
  ['dcfb1aae-7ef9-4d6a-8081-38be9431f3c6',18,2,2,0],
  ['c05255cd-6105-4c76-b623-1c15e15fd0d1',18,2,2,0],
  ['71ac3b0c-d9d3-40d6-933c-aec7d9d5065f',18,2,2,0],
  ['d2043b06-b268-44a7-9cfb-4b23706dfafb',18,2,2,0],
  ['ad683a0b-0fbe-4fd9-b30f-23a462b99f8b',15,1,3,0],
  ['74b0cfaa-e33b-4190-9e4e-8e4a74f9840c',15,1,3,0],
  ['d5bef357-d41c-4943-83cc-056218e3f41f',13,1,2,0],
  ['d578e69f-eb84-4acf-ba7d-03698b20b000',12,0,4,0],
  ['7483383e-fc3f-4641-a439-f7cee6eb6530',11,1,1,0],
  ['15f3fc75-43d6-4d1b-826e-8e4c167c0537',11,1,1,0],
  ['f3088500-337c-43ad-845c-c8f1246994ad',11,1,1,0],
  ['719b7573-21fc-49f6-9a24-096b56ff80d1',10,0,3,0],
  ['1529358a-ae33-442d-bc1b-fcd683737ab7',9,1,0,0],
  ['f3a0ab2a-4b30-49ba-8248-fcb49c3a4ae0',6,0,1,0],
  ['20ca68cc-33db-45b1-9a20-50b23d40591d',4,0,0,0],
];
let sql = "DELETE FROM monthly_payouts WHERE month='2026-10';\n";
sql += "INSERT INTO monthly_payouts (month,user_id,points,exact_hits,winner_hits,rank_group,suggested_prize,final_prize,admin_override,note) VALUES\n";
sql += users.map(u => `('2026-10','${u[0]}',${u[1]},${u[2]},${u[3]},NULL,${u[4]},${u[4]},0,'')`).join(',\n') + ';\n';
sql += "UPDATE monthly_configs SET status='approved' WHERE month='2026-10';\n";
writeFileSync('src/db/fix_oct_payouts.sql', sql);
console.log('ok');
