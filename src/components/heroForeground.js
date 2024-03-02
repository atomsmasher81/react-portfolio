import React, { useEffect ,useState} from 'react';





const HeroForeground = () => {
    const [sectionTitle, setSectionTitle] = useState('');



    useEffect(() => {
        const handleScroll = () => {
          const windowHeight = window.innerHeight;
          const compensation = windowHeight / 2;
          
          const home = document.querySelector('.landingpage').getBoundingClientRect().top - compensation;
          const help = document.querySelector('.wecanhelp').getBoundingClientRect().top - compensation;
          const statement = document.querySelector('.internet-statement').getBoundingClientRect().top - compensation;
          const projects = document.querySelector('.projects').getBoundingClientRect().top - compensation;
          const knowmore = document.querySelector('.know-more-about').getBoundingClientRect().top - compensation;
          const footer = document.querySelector('footer').getBoundingClientRect().top - compensation;
          const scrollPos = document.documentElement.scrollTop;
    
          if (scrollPos >= help && scrollPos < statement) {
            setSectionTitle('We can help');
          } else if (scrollPos >= statement && scrollPos < projects) {
            setSectionTitle('The internet');
          } else if (scrollPos >= projects && scrollPos < knowmore) {
            setSectionTitle('Work');
          } else if (scrollPos >= knowmore && scrollPos < footer) {
            setSectionTitle('Contact');
          } else {
            setSectionTitle('');
          }
        };
    
        window.addEventListener('scroll', handleScroll);
    
        // Cleanup function to remove the event listener when the component unmounts
        return () => {
          window.removeEventListener('scroll', handleScroll);
        };
     }, []);


    return (
        <div style={{zIndex:1,position:'absolute',color:'white'}}>
            {/* <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1,
                textAlign: 'center',
                color: 'white',
            }}>
                <h1>kartik</h1>
                <p>this is me taking back control!</p>
            </div> */}
     

<main>
  
<div class="section-title-underlay" style={{color:"white"}}> {sectionTitle}</div>

<section class="landingpage">Home</section>
<section class="wecanhelp">We can help you</section>
<section class="internet-statement">The Internet???</section>
<section class="projects">Work</section>
<section class="know-more-about">Contact us</section>
<footer>Footer</footer>

</main>


</div>


    );
};

export default HeroForeground;
