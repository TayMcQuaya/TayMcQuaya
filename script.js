// Modal functionality for enlarged images
function openModal(imgElement) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");

  modal.style.display = "flex"; // Show the modal
  modalImg.src = imgElement.src; // Set the clicked image as the modal image
}

function closeModal() {
  const modal = document.getElementById("imageModal");
  modal.style.display = "none"; // Hide the modal
}

// Close the modal when clicking outside the image
window.onclick = function(event) {
  const modal = document.getElementById("imageModal");
  if (event.target === modal) {
    modal.style.display = "none"; // Close modal if clicking outside the modal image
  }
};

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
