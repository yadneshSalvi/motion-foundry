import {test} from "node:test";
import assert from "node:assert/strict";
import {inspectSceneText} from "./check-shipping-scene.mjs";
const product="11111111-1111-1111-1111-111111111111",bridge="22222222-2222-2222-2222-222222222222";
const block=(id,name,script)=>`- !<ScriptComponent/${id}>\n  Name: ${name}\n  Enabled: true\n  ScriptAsset: !<reference> ${script}\n`;
const options={testScriptIds:new Set([bridge]),productScriptId:product};
test("actual bridge asset is rejected even if its component is renamed",()=>{
  const result=inspectSceneText(block(product,"MotionFoundry",product)+block(bridge,"Helper",bridge),options);
  assert.equal(result.productBindings,1);assert.match(result.failures.join("\n"),/Test script remains bound/);
});
test("an empty scene cannot pass cleanup",()=>{
  const result=inspectSceneText("",options);assert.ok(result.failures.length>=2);
});
test("a product-only scene has no test binding",()=>{
  assert.deepEqual(inspectSceneText(block(product,"MotionFoundry",product),options).failures,[]);
});
