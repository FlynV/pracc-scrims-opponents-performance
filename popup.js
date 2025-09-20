// Popup script for PRACC VLR Extension
// Check if we're on the correct page
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  const currentTab = tabs[0];
  const statusElement = document.getElementById('status-text');
  const statusDiv = document.getElementById('status');
  
  if (currentTab.url.includes('pracc.com/matches') || currentTab.url.includes('pracc.com/search')) {
    statusElement.textContent = 'Ready to use';
    statusDiv.className = 'status active';
  } else {
    statusElement.textContent = 'Navigate to pracc.com to use the extension';
    statusDiv.className = 'status inactive';
  }
});

// Add event listener for the load modal button
document.addEventListener('DOMContentLoaded', function() {
  const loadModalBtn = document.getElementById('load-modal-btn');
  
  if (loadModalBtn) {
    loadModalBtn.addEventListener('click', function() {
      // Get the current active tab
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        
        // Check if we're on a PRACC page
        if (currentTab.url.includes('pracc.com')) {
          // Inject the content script to load the modal
          chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            function: loadStatsModal
          });
          
          // Close the popup
          window.close();
        } else {
          alert('Please navigate to pracc.com first');
        }
      });
    });
  }
});

// Function to load the stats modal (injected into the page)
function loadStatsModal() {
  // Check if we're on the search page
  if (window.location.pathname.includes('/search')) {
    // Create the search stats UI
    if (typeof createSearchStatsUI === 'function') {
      createSearchStatsUI();
    } else {
      // If the function isn't available, inject the content script
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content.js');
      document.head.appendChild(script);
      
      // Wait a bit for the script to load, then create the UI
      setTimeout(() => {
        if (typeof createSearchStatsUI === 'function') {
          createSearchStatsUI();
        }
      }, 1000);
    }
  } else if (window.location.pathname.includes('/matches')) {
    // Create the matches UI
    if (typeof createExtensionUI === 'function') {
      createExtensionUI();
    } else {
      // If the function isn't available, inject the content script
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content.js');
      document.head.appendChild(script);
      
      // Wait a bit for the script to load, then create the UI
      setTimeout(() => {
        if (typeof createExtensionUI === 'function') {
          createExtensionUI();
        }
      }, 1000);
    }
  } else {
    alert('This extension works on pracc.com/matches or pracc.com/search pages');
  }
}
