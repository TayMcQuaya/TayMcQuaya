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
}
