const fs = require('fs');
const path = require('path');

const arrowSvg = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px; vertical-align: -2px; display: inline-block;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>;

['customer.js', 'product-demo.js'].forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace text arrows with SVG
    content = content.replace(/<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px; vertical-align: -2px; display: inline-block;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>/g, arrowSvg); // Windows terminal weird encoding for ?
    content = content.replace(/?/g, arrowSvg);
    
    // Replace the scroll reveal logic in customer.js
    if (file === 'customer.js') {
        const oldScroll = unction setupScrollReveals(){
   if(scrollRevealObserver){scrollRevealObserver.disconnect();scrollRevealObserver=null;}
   const items=[...document.querySelectorAll('.ce-collage > *, .ce-section-head > *, .ce-roles > *, .ce-team > *')];
   if(!items.length)return;
   items.forEach((item,index)=>{item.classList.add('cc-scroll-reveal');item.style.setProperty('--reveal-delay',\\ms\);});
   if(!('IntersectionObserver' in window)){items.forEach(item=>item.classList.add('is-visible'));return;}
   scrollRevealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');scrollRevealObserver?.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px -2% 0px'});
   items.forEach(item=>scrollRevealObserver.observe(item));
  };
  
        const newScroll = unction setupScrollReveals(){
   if(scrollRevealObserver){scrollRevealObserver.disconnect();scrollRevealObserver=null;}
   const items=[...document.querySelectorAll('.reveal-on-scroll')];
   if(!items.length)return;
   if(!('IntersectionObserver' in window)){items.forEach(item=>item.classList.add('is-revealed'));return;}
   scrollRevealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-revealed');scrollRevealObserver?.unobserve(entry.target);}}),{threshold:0.1,rootMargin:'0px 0px -50px 0px'});
   items.forEach(item=>scrollRevealObserver.observe(item));
  };
        
        content = content.replace(oldScroll, newScroll);
    }
    
    fs.writeFileSync(filePath, content);
});
