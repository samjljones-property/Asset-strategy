/* Adapter between scenario plans and lease cash flows. */
(function(root){
'use strict';
function adapt(model,id){
 const scenario=model.scenarios.find(s=>s.id===id);
 if(!scenario)throw Error('Unknown scenario');
 return {scenario,asset:model.asset};
}
const api={adapt};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.AssetScenarioAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this);
