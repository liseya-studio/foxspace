import {test,expect} from "@playwright/test";
import {DEFAULT_GRID,normalizeSettings,intersects,nextSlot,reposition,reconcileGrid} from "../src/features/editor/gridLayout";
test("grid supports move and resize without overlap",()=>{
 const base={settings:{...DEFAULT_GRID,columns:16,rows:12},positions:{a:{x:0,y:0,w:4,h:3},b:{x:4,y:0,w:4,h:3}}};
 expect(reposition(base,"a",{x:4,y:0,w:4,h:3})).toBeNull();
 const moved=reposition(base,"a",{x:0,y:3,w:4,h:5});
 expect(moved?.positions.a).toEqual({x:0,y:3,w:4,h:5});
 expect(reposition(moved!,"a",{x:0,y:3,w:20,h:5})).toBeNull();
 expect(intersects({x:0,y:0,w:1,h:1},{x:1,y:0,w:1,h:1})).toBe(false);
 expect(nextSlot(4,3,base.positions,base.settings)).toEqual({x:8,y:0,w:4,h:3});
});
test("legacy widgets keep unique positions",()=>{
 const layout=reconcileGrid(undefined,[{id:"a",width:6,height:205},{id:"b",width:6,height:205},{id:"c",width:12,height:300}]);
 expect(Object.keys(layout.positions)).toHaveLength(3);
 expect(intersects(layout.positions.a,layout.positions.b)).toBe(false);
 expect(layout.positions.c.y).toBeGreaterThanOrEqual(3);
 expect(normalizeSettings({columns:16,rows:12,gap:8}).columns).toBe(16);
});
