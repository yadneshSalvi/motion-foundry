import {describe,expect,it} from 'vitest';
import {planCrankContactPlacement} from '../../lens-src/tests/WorkbenchContactPlan';
import {makeWorkbenchReference,WORKBENCH_KEEP_OUT} from '../../lens-src/WorkbenchProfile';
import {verifyLoopCandidate} from '../../lens-src/LoopDomain';

describe('bounded genuine mug placement',()=>{
  it('distinguishes a clearance-buffer intrusion from physical rod contact using the unchanged verifier',()=>{
    const reference=makeWorkbenchReference(),input=structuredClone(reference.input),parameters={...reference.candidate.parameters,crankCm:3.930607990786299};
    input.obstacles=[structuredClone(WORKBENCH_KEEP_OUT)];
    const before=verifyLoopCandidate(input,parameters);
    expect(before.collisionWitness?.geometry).toBe('crank');
    expect(before.collisionWitness!.marginCm).toBeLessThan(0);
    expect(before.collisionWitness!.marginCm+input.clearanceCm).toBeGreaterThan(0);
    const plan=planCrankContactPlacement(parameters.crankCm,input.linkRadiusCm,WORKBENCH_KEEP_OUT.center,WORKBENCH_KEEP_OUT.radiusCm);
    expect(plan.inwardCm).toBe(.06);expect(plan.center).toEqual({x:-8.84,y:0});
    const requested=structuredClone(input);requested.obstacles[0].center=plan.center;
    const after=verifyLoopCandidate(requested,parameters);
    expect(after.collisionWitness!.marginCm+input.clearanceCm).toBeLessThan(-.04);
    expect(input.obstacles[0].center).toEqual({x:-8.9,y:0});
  });
  it('retains an existing physical contact without an unnecessary extra drag',()=>{
    expect(planCrankContactPlacement(4,.45,{x:-8.9,y:0},4.5)).toMatchObject({inwardCm:0,center:{x:-8.9,y:0}});
  });
  it('rejects an unsuitable gap instead of moving the obstacle arbitrarily or weakening a tolerance',()=>{
    expect(()=>planCrankContactPlacement(3,.45,{x:-8.9,y:0},4.5)).toThrow('bounded');
    expect(()=>planCrankContactPlacement(NaN,.45,{x:-8.9,y:0},4.5)).toThrow('Finite');
  });
});
