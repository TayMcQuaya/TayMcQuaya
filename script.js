// Loading Animation
document.addEventListener('DOMContentLoaded', function() {
  // Create and add loader if it doesn't exist
  if (!document.querySelector('.loader-wrapper')) {
    const loaderWrapper = document.createElement('div');
    loaderWrapper.className = 'loader-wrapper';
    loaderWrapper.innerHTML = `
      <div class="loader">
        <div class="loader-circle"></div>
        <div class="loader-circle"></div>
        <div class="loader-circle"></div>
        <div class="loader-dot"></div>
      </div>
      <div class="loader-text">LOADING</div>
    `;
    document.body.insertBefore(loaderWrapper, document.body.firstChild);
    
    // Remove loader after content loads
    setTimeout(() => {
      loaderWrapper.classList.add('fade-out');
      setTimeout(() => {
        loaderWrapper.remove();
      }, 500);
    }, 1500);
  }
});

// Modal functionality for enlarged images
function openModal(imgElement) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");

  modal.style.display = "flex"; // Show the modal
  modalImg.src = imgElement.src; // Set the clicked image as the modal image
  
  // Add animation class
  setTimeout(() => {
    modalImg.style.transform = 'scale(1)';
    modalImg.style.opacity = '1';
  }, 10);
}

function closeModal() {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  
  modalImg.style.transform = 'scale(0.8)';
  modalImg.style.opacity = '0';
  
  setTimeout(() => {
    modal.style.display = "none"; // Hide the modal
  }, 300);
}

// Close the modal when clicking outside the image
window.onclick = function(event) {
  const modal = document.getElementById("imageModal");
  if (event.target === modal) {
    closeModal();
  }
};

// Intersection Observer for entrance animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
  entries.forEach((entry, index) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, index * 100); // Stagger effect
    }
  });
}, observerOptions);

// Observe all elements with animation classes
document.addEventListener('DOMContentLoaded', function() {
  // Add animation classes to elements
  const sections = document.querySelectorAll('.section');
  sections.forEach(section => {
    section.classList.add('fade-in');
  });
  
  const headings = document.querySelectorAll('h1, h2');
  headings.forEach(heading => {
    heading.classList.add('fade-in');
  });
  
  const portfolioItems = document.querySelectorAll('.portfolio-slider .item');
  portfolioItems.forEach(item => {
    item.classList.add('scale-in');
  });
  
  const gridItems = document.querySelectorAll('.artwork-item, .website-item, .app-item');
  gridItems.forEach(item => {
    item.classList.add('stagger-item');
  });
  
  // Start observing
  document.querySelectorAll('.fade-in, .slide-in-left, .slide-in-right, .scale-in, .stagger-item').forEach(el => {
    observer.observe(el);
  });
});

// Navigation scroll effect
let lastScrollTop = 0;
window.addEventListener('scroll', function() {
  const nav = document.querySelector('nav');
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  
  if (scrollTop > 100) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
  
  lastScrollTop = scrollTop;
});

// Parallax effect for hero section
window.addEventListener('scroll', function() {
  const scrolled = window.pageYOffset;
  const parallaxElements = document.querySelectorAll('.profile-pic-container');
  
  parallaxElements.forEach(element => {
    const speed = 0.5;
    element.style.transform = `translateY(${scrolled * speed}px)`;
  });
});

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Add typewriter effect to hero text
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    const heroText = document.querySelector('#home p');
    if (heroText && !heroText.classList.contains('typewriter-processed')) {
      // Wrap the text in a span for typewriter effect
      const text = heroText.innerHTML;
      heroText.innerHTML = '<span class="typewriter">' + text + '</span>';
      heroText.classList.add('typewriter-processed');
      heroText.style.textAlign = 'center';
    }
  }, 100); // Small delay to ensure page is ready
});

// GIF Switching Logic
window.onload = function() {
  const gif1 = document.getElementById('gif1');
  const gif2 = document.getElementById('gif2');

  if (gif1 && gif2) {  // Check if the GIF elements exist before running the switchGifs function
    console.log('Switching GIFs initialized');

    function switchGifs() {
      console.log('Showing GIF 1');
      gif1.style.display = 'block';  // Ensure GIF1 is visible initially
      gif2.style.display = 'none';   // Ensure GIF2 is hidden

      setTimeout(() => {
        gif1.style.display = 'none';  // Hide GIF 1
        gif2.style.display = 'block'; // Show GIF 2
        console.log('Switched to GIF 2');

        // Switch back after the second GIF ends (45 seconds)
        setTimeout(() => {
          gif2.style.display = 'none';  // Hide GIF 2
          gif1.style.display = 'block'; // Show GIF 1
          console.log('Switched back to GIF 1');
          switchGifs(); // Start the cycle again
        }, 45000); // Duration of the second GIF (45 seconds)
      }, 5000); // Duration of the first GIF (6 seconds)
    }

    // Start the switching process after the page has fully loaded
    switchGifs();
  }
};
