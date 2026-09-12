import sys

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 1. SVG Arrow replacement (matches unicode right arrow)
        svg_arrow = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px; vertical-align: -2px; display: inline-block;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>'
        content = content.replace('→', svg_arrow)
        content = content.replace('â†’', svg_arrow)
        
        # 2. Scroll logic fix for customer.js
        if 'customer.js' in filepath:
            old_scroll = '''function setupScrollReveals(){
   if(scrollRevealObserver){scrollRevealObserver.disconnect();scrollRevealObserver=null;}
   const items=[...document.querySelectorAll('.ce-collage > *, .ce-section-head > *, .ce-roles > *, .ce-team > *')];
   if(!items.length)return;
   items.forEach((item,index)=>{item.classList.add('cc-scroll-reveal');item.style.setProperty('--reveal-delay',${(index%3)*110}ms);});
   if(!('IntersectionObserver' in window)){items.forEach(item=>item.classList.add('is-visible'));return;}
   scrollRevealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');scrollRevealObserver?.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px -2% 0px'});
   items.forEach(item=>scrollRevealObserver.observe(item));
  }'''
            new_scroll = '''function setupScrollReveals(){
   if(scrollRevealObserver){scrollRevealObserver.disconnect();scrollRevealObserver=null;}
   const items=[...document.querySelectorAll('.reveal-on-scroll')];
   if(!items.length)return;
   if(!('IntersectionObserver' in window)){items.forEach(item=>item.classList.add('is-revealed'));return;}
   scrollRevealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-revealed');scrollRevealObserver?.unobserve(entry.target);}}),{threshold:0.05,rootMargin:'0px 0px -5% 0px'});
   items.forEach(item=>scrollRevealObserver.observe(item));
  }'''
            if old_scroll in content:
                content = content.replace(old_scroll, new_scroll)
                print("Updated scroll logic in customer.js")
            else:
                print("Could not find old_scroll exactly, trying partial replace...")
                content = content.replace(".ce-collage > *, .ce-section-head > *, .ce-roles > *, .ce-team > *", ".reveal-on-scroll")
                content = content.replace("cc-scroll-reveal", "is-revealed")
                content = content.replace("is-visible", "is-revealed")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
        print(f"Processed {filepath}")
    except Exception as e:
        print(f"Error on {filepath}: {e}")

process_file('customer.js')
process_file('product-demo.js')
