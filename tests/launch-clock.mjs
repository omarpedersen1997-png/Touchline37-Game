import plan from'../release/launch.json' with{type:'json'};
export async function beforeLaunch(run){const original=Date.now;Date.now=()=>Date.parse(plan.opensAt)-1;try{return await run()}finally{Date.now=original}}
