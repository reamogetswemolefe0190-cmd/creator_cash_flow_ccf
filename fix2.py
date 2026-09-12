import sys

def rewrite_scroll(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        import re
        # Find the function and replace it entirely
        pattern = r"function setupScrollReveals\(\)\{.*?\n  \}"
        replacement = '''function setupScrollReveals(){
   if(scrollRevealObserver){scrollRevealObserver.disconnect();scrollRevealObserver=null;}
   const items=[...document.querySelectorAll('.reveal-on-scroll')];
   if(!items.length)return;
   if(!('IntersectionObserver' in window)){items.forEach(item=>item.classList.add('is-revealed'));return;}
   scrollRevealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-revealed');scrollRevealObserver?.unobserve(entry.target);}}),{threshold:0.05,rootMargin:'0px 0px -5% 0px'});
   items.forEach(item=>scrollRevealObserver.observe(item));
  }'''
        
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
        print("Fixed scroll logic completely.")
    except Exception as e:
        print(f"Error: {e}")

rewrite_scroll('customer.js')
