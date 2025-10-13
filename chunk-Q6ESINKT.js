function m(r,t=5e3){let e,i=new Promise((n,o)=>{e=setTimeout(()=>o(new Error("TIMEOUT")),t)});return Promise.race([r,i]).finally(()=>clearTimeout(e))}export{m as a};
