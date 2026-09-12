const fs = require('fs');

const file = 'customer.js';
let content = fs.readFileSync(file, 'utf8');

// Wipe the entire setupScrollReveals function using substring manipulation because regex with dotall is annoying
const startStr = 'function setupScrollReveals(){';
const endStr = '  }'; // First occurrence of '  }' after startStr
const startIndex = content.indexOf(startStr);

if (startIndex !== -1) {
    const endIndex = content.indexOf(endStr, startIndex) + endStr.length;
    
    const newFunc = \unction setupScrollReveals(){
   if(scrollRevealObserver){scrollRevealObserver.disconnect();scrollRevealObserver=null;}
   const items=[...document.querySelectorAll('.reveal-on-scroll')];
   if(!items.length)return;
   if(!('IntersectionObserver' in window)){items.forEach(item=>item.classList.add('is-revealed'));return;}
   scrollRevealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-revealed');scrollRevealObserver?.unobserve(entry.target);}}),{threshold:0.05,rootMargin:'0px 0px -5% 0px'});
   items.forEach(item=>scrollRevealObserver.observe(item));
  }\;
    
    content = content.substring(0, startIndex) + newFunc + content.substring(endIndex);
    fs.writeFileSync(file, content);
    console.log("Successfully replaced function in customer.js");
} else {
    console.log("Could not find startStr");
}
