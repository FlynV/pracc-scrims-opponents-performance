// Content script for PRACC Matches VLR Extension
console.log('PRACC VLR Extension loaded');

// Test background script connection
chrome.runtime.sendMessage({ action: 'test' }, (response) => {
  console.log('Background script test response:', response);
});

// Check if we're on the search page
const isSearchPage = window.location.pathname.includes('/search');

// Store search API response data
let searchApiResponse = null;

if (isSearchPage) {
  console.log('PRACC Search page detected - monitoring API calls');
  console.log('Current URL:', window.location.href);
  console.log('Document ready state:', document.readyState);
  
  // Immediately check for any existing API calls that might have already been made
  if (window.performance && window.performance.getEntriesByType) {
    const entries = window.performance.getEntriesByType('resource');
    entries.forEach(entry => {
      if (entry.name.includes('/api/search')) {
        console.log('🔍 Found existing search API call in performance entries:');
        console.log('URL:', entry.name);
        console.log('---');
      }
    });
  }
  
  // Function to log search API endpoint
  function logSearchEndpoint(url, method = 'GET') {
    console.log('🔍 PRACC Search API Endpoint Captured:');
    console.log('Method:', method);
    console.log('URL:', url);
    
    // Parse and log the filter parameter if it exists
    try {
      const urlObj = new URL(url, window.location.origin);
      const filterParam = urlObj.searchParams.get('filter');
      if (filterParam) {
        const decodedFilter = decodeURIComponent(filterParam);
        console.log('Filter (decoded):', decodedFilter);
        
        // Try to parse as JSON for better readability
        try {
          const filterObj = JSON.parse(decodedFilter);
          console.log('Filter (parsed):', filterObj);
        } catch (e) {
          console.log('Filter (raw):', decodedFilter);
        }
      }
    } catch (e) {
      console.log('Error parsing URL:', e);
    }
    
    console.log('---');
  }
  
  // Intercept fetch requests to log search API calls (for debugging)
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    
    // Check if this is a search API call
    if (typeof url === 'string' && url.includes('/api/search')) {
      logSearchEndpoint(url, 'GET');
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Also monitor XMLHttpRequest (for debugging)
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (typeof url === 'string' && url.includes('/api/search')) {
      logSearchEndpoint(url, method);
    }
    return originalXHROpen.call(this, method, url, ...args);
  };
  
  // No automatic processing - user must click "Fetch Teams" button
}

// Function to process search results and create stats UI
async function processSearchResults(requests) {
  console.log('Processing search results:', requests);
  
  // Create or update the extension UI
  createSearchStatsUI();
  
  // Group teams by their available maps
  const teamMapStats = new Map();
  
  for (const request of requests) {
    const team = request.Team;
    const maps = request.Maps;
    const time = request.Time;
    const region = request.Region;
    
    // Get map names for this team's available maps
    const mapNames = await Promise.all(maps.map(mapId => getMapInfo(mapId)));
    
    // Store team data with their available maps
    if (!teamMapStats.has(team.ID)) {
      teamMapStats.set(team.ID, {
        team: team,
        maps: new Map(),
        region: region,
        time: time
      });
    }
    
    const teamData = teamMapStats.get(team.ID);
    
    // Add maps for this time slot
    mapNames.forEach((mapInfo, index) => {
      const mapId = maps[index];
      if (!teamData.maps.has(mapId)) {
        teamData.maps.set(mapId, {
          mapId: mapId,
          mapName: mapInfo.displayName,
          mapIcon: mapInfo.listViewIcon,
          time: time
        });
      }
    });
  }
  
  // Store team data globally for team picker
  window.praccTeamData = teamMapStats;
  
  // Populate team picker
  populateTeamPicker(teamMapStats);
  
  // Show success message
  const container = document.getElementById('search-stats-container');
  if (container) {
    container.innerHTML = `
      <div class="success-message">
        <h4>Teams Loaded Successfully!</h4>
        <p>Found ${teamMapStats.size} teams. Select a team from the dropdown above to view their statistics.</p>
      </div>
    `;
  }
}

// Function to create the search stats UI
function createSearchStatsUI() {
  // Remove existing UI if it exists
  const existingUI = document.getElementById('pracc-search-stats');
  if (existingUI) {
    existingUI.remove();
  }

  // Create main container
  const container = document.createElement('div');
  container.id = 'pracc-search-stats';
  
  container.innerHTML = `
    <div class="pracc-search-header">
      <div class="header-title-section">
        <h3>Opponents Performance</h3>
        <button id="fetch-teams-btn" class="fetch-btn">Fetch Teams</button>
      </div>
      <button id="close-search-stats" class="close-btn">×</button>
    </div>
    <div class="controls-section" id="controls-section" style="display: none;">
      <div class="team-selector" id="team-selector">
        <label for="team-picker">Team:</label>
        <select id="team-picker" class="team-picker-select">
          <option value="">Select a team...</option>
        </select>
      </div>
        <div class="date-range-selector">
          <label for="search-date-range">Period:</label>
          <select id="search-date-range" class="date-range-select">
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        <div class="custom-date-range" id="custom-date-range" style="display: none;">
          <div class="date-input-group">
            <label for="start-date">From:</label>
            <input type="date" id="start-date" class="date-input">
          </div>
          <div class="date-input-group">
            <label for="end-date">To:</label>
            <input type="date" id="end-date" class="date-input">
          </div>
        </div>
    </div>
    <div id="search-stats-container" class="search-stats-container">
      <div class="welcome-message">
        <h4>Welcome to Opponents Performance</h4>
        <p>Click "Fetch Teams" to load available teams from the current search results.</p>
        <p>Then select a team to view their detailed statistics for each map.</p>
      </div>
    </div>
  `;

  // Insert the container at the top of the page
  const body = document.body;
  if (body) {
    body.insertBefore(container, body.firstChild);
  }

  // Add event listeners
  const closeBtn = document.getElementById('close-search-stats');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      container.remove();
    });
  }
  
  // Make the app draggable
  makeDraggable(container);
  
  const fetchTeamsBtn = document.getElementById('fetch-teams-btn');
  if (fetchTeamsBtn) {
    fetchTeamsBtn.addEventListener('click', () => {
      console.log('📥 Fetch Teams button clicked');
      fetchTeamsFromSearch();
    });
  }
  
  // Add event listener for team picker
  const teamPicker = document.getElementById('team-picker');
  if (teamPicker) {
    teamPicker.addEventListener('change', (e) => {
      const selectedTeamId = e.target.value;
      console.log('Team picker changed to:', selectedTeamId);
      if (selectedTeamId) {
        console.log('Displaying stats for team:', selectedTeamId);
        displaySelectedTeamStats(selectedTeamId);
      } else {
        console.log('No team selected, showing welcome message');
        const container = document.getElementById('search-stats-container');
        if (container) {
          container.innerHTML = `
            <div class="welcome-message">
              <h4>Welcome to Opponents Performance</h4>
              <p>Click "Fetch Teams" to load available teams from the current search results.</p>
              <p>Then select a team to view their detailed statistics for each map.</p>
            </div>
          `;
        }
      }
    });
  } else {
    console.log('Team picker element not found!');
  }
  
  // Add event listener for date range selector
  const dateRangeSelect = document.getElementById('search-date-range');
  if (dateRangeSelect) {
    dateRangeSelect.value = dateRange.toString();
    dateRangeSelect.addEventListener('change', (e) => {
      const customDateRange = document.getElementById('custom-date-range');
      if (e.target.value === 'custom') {
        customDateRange.style.display = 'flex';
        // Set default dates (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
        document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
      } else {
        customDateRange.style.display = 'none';
        dateRange = parseInt(e.target.value);
        teamStatsCache.clear(); // Clear cache when date range changes
        const selectedTeamId = document.getElementById('team-picker')?.value;
        if (selectedTeamId) {
          displaySelectedTeamStats(selectedTeamId);
        }
      }
    });
  }
  
  // Add event listeners for custom date inputs
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  
  if (startDateInput && endDateInput) {
    const updateCustomDateRange = () => {
      const startDate = startDateInput.value;
      const endDate = endDateInput.value;
      
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Update the dateRange variable with custom range
        window.customDateRange = { start: startDate, end: endDate, days: diffDays };
        teamStatsCache.clear(); // Clear cache when date range changes
        
        const selectedTeamId = document.getElementById('team-picker')?.value;
        if (selectedTeamId) {
          displaySelectedTeamStats(selectedTeamId);
        }
      }
    };
    
    startDateInput.addEventListener('change', updateCustomDateRange);
    endDateInput.addEventListener('change', updateCustomDateRange);
  }
}

// Function to fetch teams from search API
async function fetchTeamsFromSearch() {
  console.log('📥 Fetching teams from search API...');
  
  const container = document.getElementById('search-stats-container');
  if (container) {
    container.innerHTML = '<div class="loading">Fetching teams from search results...</div>';
  }
  
  try {
    // Try to get search data from performance entries
    if (window.performance && window.performance.getEntriesByType) {
      const entries = window.performance.getEntriesByType('resource');
      const searchEntries = entries.filter(entry => entry.name.includes('/api/search'));
      
      if (searchEntries.length > 0) {
        const latestEntry = searchEntries[searchEntries.length - 1];
        console.log('📥 Using latest search API entry:', latestEntry.name);
        
        const response = await fetch(latestEntry.name);
        const data = await response.json();
        
        console.log('📥 Search API data received:', data);
        
        if (data && data.Requests && data.Requests.length > 0) {
          console.log('📥 Processing search results with', data.Requests.length, 'requests');
          await processSearchResults(data.Requests);
        } else {
          console.log('📥 No requests found in search response');
          if (container) {
            container.innerHTML = `
              <div class="error-message">
                <h4>No Teams Found</h4>
                <p>No teams were found in the current search results. Please perform a search on the PRACC platform first.</p>
              </div>
            `;
          }
        }
      } else {
        console.log('📥 No search API entries found');
        if (container) {
          container.innerHTML = `
            <div class="error-message">
              <h4>No Search Data</h4>
              <p>No search data found. Please perform a search on the PRACC platform first, then click "Fetch Teams".</p>
            </div>
          `;
        }
      }
    } else {
      console.log('📥 Performance API not available');
      if (container) {
        container.innerHTML = `
          <div class="error-message">
            <h4>Error</h4>
            <p>Unable to access search data. Please refresh the page and try again.</p>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('📥 Error fetching teams:', error);
    if (container) {
      container.innerHTML = `
        <div class="error-message">
          <h4>Error</h4>
          <p>Failed to fetch teams. Please try again.</p>
        </div>
      `;
    }
  }
}

// Function to populate team picker dropdown
function populateTeamPicker(teamMapStats) {
  const teamPicker = document.getElementById('team-picker');
  const teamSelector = document.getElementById('team-selector');
  
  if (!teamPicker) {
    console.log('Team picker element not found in populateTeamPicker!');
    return;
  }
  
  console.log('Populating team picker with', teamMapStats.size, 'teams');
  
  // Clear existing options except the first one
  teamPicker.innerHTML = '<option value="">Select a team...</option>';
  
  // Separate teams with and without VLR links
  const teamsWithVlr = [];
  const teamsWithoutVlr = [];
  
  for (const [teamId, teamData] of teamMapStats) {
    const team = teamData.team;
    const hasVlrLink = team.Links && team.Links.some(link => link.Type === 'vlrgg');
    
    if (hasVlrLink) {
      teamsWithVlr.push({ teamId, teamData });
    } else {
      teamsWithoutVlr.push({ teamId, teamData });
    }
  }
  
  // Add teams with VLR links first (prioritized)
  teamsWithVlr.forEach(({ teamId, teamData }) => {
    const team = teamData.team;
    const option = document.createElement('option');
    option.value = teamId.toString();
    option.textContent = `⭐ ${team.Name} (${teamData.region.toUpperCase()})`;
    option.setAttribute('data-logo', team.Logo);
    option.setAttribute('data-has-vlr', 'true');
    teamPicker.appendChild(option);
    console.log('Added VLR team to picker:', team.Name, 'ID:', teamId);
  });
  
  // Add teams without VLR links
  teamsWithoutVlr.forEach(({ teamId, teamData }) => {
    const team = teamData.team;
    const option = document.createElement('option');
    option.value = teamId.toString();
    option.textContent = `${team.Name} (${teamData.region.toUpperCase()})`;
    option.setAttribute('data-logo', team.Logo);
    option.setAttribute('data-has-vlr', 'false');
    teamPicker.appendChild(option);
    console.log('Added non-VLR team to picker:', team.Name, 'ID:', teamId);
  });
  
  // Add custom styling for team logos in dropdown
  const style = document.createElement('style');
  style.textContent = `
    .team-picker-select option {
      background-repeat: no-repeat;
      background-position: 8px center;
      background-size: 16px 16px;
      padding-left: 32px;
    }
    .team-picker-select option[data-has-vlr="true"] {
      background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjgiIHk9IjgiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI4IiBmaWxsPSIjNjY3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+VjwvdGV4dD4KPC9zdmc+');
    }
    .team-picker-select option[data-has-vlr="false"] {
      background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjgiIHk9IjgiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI4IiBmaWxsPSIjNjY3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TjwvdGV4dD4KPC9zdmc+');
    }
  `;
  document.head.appendChild(style);
  
  // Show the controls section
  const controlsSection = document.getElementById('controls-section');
  if (controlsSection) {
    controlsSection.style.display = 'flex';
  }
  
  console.log('Team picker populated with', teamPicker.options.length - 1, 'teams');
}

// Function to display stats for selected team
async function displaySelectedTeamStats(teamId) {
  console.log('displaySelectedTeamStats called with teamId:', teamId);
  
  const container = document.getElementById('search-stats-container');
  if (!container) {
    console.log('Search stats container not found!');
    return;
  }
  
  if (!window.praccTeamData) {
    console.log('No team data available!');
    return;
  }
  
  // Try to find team data with both string and number ID
  let teamData = window.praccTeamData.get(teamId);
  if (!teamData) {
    // Try with number ID if string didn't work
    teamData = window.praccTeamData.get(parseInt(teamId));
  }
  if (!teamData) {
    // Try with string ID if number didn't work
    teamData = window.praccTeamData.get(teamId.toString());
  }
  
  if (!teamData) {
    console.log('Team data not found for ID:', teamId);
    console.log('Available teams:', Array.from(window.praccTeamData.keys()));
    return;
  }
  
  console.log('Found team data for:', teamData.team.Name);
  console.log('Team data structure:', teamData.team);
  console.log('Team links:', teamData.team.Links);
  
  const team = teamData.team;
  
  // Check if team has VLR link
  const vlrLink = team.Links && team.Links.find(link => link.Type === 'vlrgg');
  
  if (!vlrLink) {
    // No VLR available - show simple message
    container.innerHTML = `
      <div class="selected-team-card">
        <div class="team-header">
          <img src="${team.Logo}" alt="${team.Name}" class="team-logo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjIwIiB5PSIyMCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tk88L3RleHQ+Cjwvc3ZnPg=='">
          <div class="team-info">
            <h4 class="team-name">${team.Name}</h4>
            <span class="team-region">${teamData.region.toUpperCase()}</span>
          </div>
        </div>
        <div class="no-vlr-message">
          <h5>No VLR Available</h5>
          <p>This team doesn't have VLR.gg data available for statistics.</p>
        </div>
      </div>
    `;
    return;
  }
  
  // Get specific maps only
  const allMaps = await fetchMapData();
  const specificMapNames = getSpecificMaps();
  
  container.innerHTML = `
    <div class="selected-team-card">
      <div class="team-header">
        <img src="${team.Logo}" alt="${team.Name}" class="team-logo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjIwIiB5PSIyMCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tk88L3RleHQ+Cjwvc3ZnPg=='">
        <div class="team-info">
          <h4 class="team-name">${team.Name}</h4>
          <span class="team-region">${teamData.region.toUpperCase()}</span>
        </div>
      </div>
      <div class="maps-container">
        <h5>Maps (${specificMapNames.length}):</h5>
        <div class="maps-grid">
          ${specificMapNames.map(mapName => {
            const mapInfo = allMaps.find(m => m.displayName === mapName);
            return `
              <div class="map-card" data-map-name="${mapName}" data-team-id="${teamId}">
                <div class="map-header">
                  ${mapInfo && mapInfo.listViewIcon ? `
                    <img src="${mapInfo.listViewIcon}" alt="${mapName}" class="map-icon">
                  ` : ''}
                  <span class="map-name">${mapName}</span>
                </div>
                <div class="map-stats skeleton-loading">
                  <div class="skeleton-stats wide"></div>
                  <div class="skeleton-stats medium"></div>
                  <div class="skeleton-stats narrow"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  
  // Load stats for each map
  for (const mapName of specificMapNames) {
    await loadMapStats(teamId, mapName);
  }
  
  // Check if any maps are visible after loading
  setTimeout(() => {
    checkVisibleMaps(teamId);
  }, 1000);
}

// Function to load stats for a specific map
async function loadMapStats(teamId, mapName, mapId = null) {
  const mapCard = document.querySelector(`[data-team-id="${teamId}"][data-map-name="${mapName}"]`);
  if (!mapCard) return;
  
  const statsContainer = mapCard.querySelector('.map-stats');
  if (!statsContainer) return;
  
  // Remove skeleton loading class
  statsContainer.classList.remove('skeleton-loading');
  
  try {
    // Check if team has VLR link
    const teamCard = document.querySelector(`[data-team-id="${teamId}"]`);
    
    // Get team data from our stored data
    let teamData = null;
    if (window.praccTeamData) {
      // Try to find team data with both string and number ID
      teamData = window.praccTeamData.get(teamId);
      if (!teamData) {
        teamData = window.praccTeamData.get(parseInt(teamId));
      }
      if (!teamData) {
        teamData = window.praccTeamData.get(teamId.toString());
      }
    }
    
    if (!teamData || !teamData.team || !teamData.team.Links) {
      console.log('No VLR data available for team:', teamId);
      statsContainer.innerHTML = '<div class="no-stats">No VLR data available</div>';
      return;
    }
    
    const team = teamData.team;
    
    const vlrLink = team.Links.find(link => link.Type === 'vlrgg');
    if (!vlrLink) {
      console.log('No VLR link found for team:', team.Name);
      statsContainer.innerHTML = '<div class="no-stats">No VLR link</div>';
      return;
    }
    
    const vlrTeamId = extractTeamIdFromVlrLink(vlrLink.Url);
    if (!vlrTeamId) {
      console.log('Invalid VLR link for team:', team.Name, 'URL:', vlrLink.Url);
      statsContainer.innerHTML = '<div class="no-stats">Invalid VLR link</div>';
      return;
    }
    
    console.log('Fetching VLR stats for team:', team.Name, 'VLR ID:', vlrTeamId, 'Map:', mapName);
    
    // Fetch team stats
    const teamStats = await fetchTeamStats(vlrTeamId, mapName);
    
    if (teamStats) {
      console.log('Successfully loaded stats for team:', team.Name, 'Map:', mapName, 'Stats:', teamStats);
      
      // Check if this map was actually played (has play count > 0)
      const playCount = teamStats.playCount || 0;
      if (playCount === 0) {
        // Hide this map card if it wasn't played
        mapCard.style.display = 'none';
        // Check if any maps are left after hiding this one
        setTimeout(() => checkVisibleMaps(teamId), 100);
        return;
      }
      
      statsContainer.innerHTML = `
        <div class="stats-row">
          <span class="stat-label">Win Rate:</span>
          <span class="stat-value">${teamStats.winRate || 'N/A'}</span>
        </div>
        <div class="stats-row">
          <span class="stat-label">ATK:</span>
          <span class="stat-value">${teamStats.atkWinRate || 'N/A'}</span>
          <span class="stat-label">DEF:</span>
          <span class="stat-value">${teamStats.defWinRate || 'N/A'}</span>
        </div>
        <div class="stats-row">
          <span class="stat-label">Plays:</span>
          <span class="stat-value">${playCount}</span>
        </div>
        ${teamStats.agentCompositions && teamStats.agentCompositions.length > 0 ? `
          <div class="agent-compositions">
            <div class="compositions-label">Top Composition:</div>
            <div class="compositions-list">
              ${teamStats.agentCompositions.slice(0, 1).map(comp => `
                <div class="composition">
                  <span class="comp-count">(${comp.count || '1'})</span>
                  <div class="agent-icons">
                    ${comp.agents.map(agent => `
                      <img src="${agent.image}" alt="${agent.name}" class="agent-icon" title="${agent.name}">
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        <div class="vlr-link-container">
          <a href="${generateVlrStatsUrl(vlrTeamId, dateRange)}" target="_blank" class="vlr-link" title="View full stats on VLR">
            <img src="https://www.vlr.gg/img/vlr/logo_header.png" alt="VLR" class="vlr-icon">
            <span>View Stats</span>
          </a>
        </div>
      `;
    } else {
      console.log('Failed to load stats for team:', team.Name, 'Map:', mapName);
      // Hide this map card if stats failed to load
      mapCard.style.display = 'none';
      // Check if any maps are left after hiding this one
      setTimeout(() => checkVisibleMaps(teamId), 100);
    }
  } catch (error) {
    console.error(`Error loading stats for team ${teamId} on ${mapName}:`, error);
    statsContainer.innerHTML = '<div class="no-stats">Error loading stats</div>';
    // Hide this map card if there was an error
    mapCard.style.display = 'none';
    // Check if any maps are left after hiding this one
    setTimeout(() => checkVisibleMaps(teamId), 100);
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'statsUpdate') {
    console.log('Content: Received stats update from background:', request);
    // Update the UI with the new stats
    updateTeamStatsInUI(request.teamId, request.mapName, request.data);
  } else if (request.action === 'statsError') {
    console.log('Content: Received stats error from background:', request);
  }
});

// Map data cache
let mapDataCache = null;

// Team stats cache
let teamStatsCache = new Map();

// Date range settings
let dateRange = 30; // Default to 30 days

// Function to update team stats in UI
function updateTeamStatsInUI(teamId, mapName, stats) {
  console.log(`Content: Updating UI for team ${teamId} on ${mapName}:`, stats);
  
  // Find the match card that needs updating by looking for the team ID in data attributes
  const matchCards = document.querySelectorAll('.match-card');
  matchCards.forEach(card => {
    const teamIdAttr = card.getAttribute('data-team-id');
    if (teamIdAttr === teamId.toString()) {
      console.log(`Content: Found matching card for team ${teamId}`);
      
      // Update the team stats section
      let statsSection = card.querySelector('.team-stats');
      if (!statsSection) {
        // Create stats section if it doesn't exist
        const teamDetails = card.querySelector('.team-details');
        if (teamDetails) {
          statsSection = document.createElement('div');
          statsSection.className = 'team-stats';
          teamDetails.appendChild(statsSection);
        }
      }
      
      if (statsSection && stats) {
        // Update the stats content
        statsSection.innerHTML = `
          <div class="stats-row">
            <span class="stat-label">Win Rate:</span>
            <span class="stat-value">${stats.winRate || 'N/A'}</span>
          </div>
          <div class="stats-row">
            <span class="stat-label">ATK:</span>
            <span class="stat-value">${stats.atkWinRate || 'N/A'}</span>
            <span class="stat-label">DEF:</span>
            <span class="stat-value">${stats.defWinRate || 'N/A'}</span>
          </div>
          ${stats.agentCompositions && stats.agentCompositions.length > 0 ? `
            <div class="agent-compositions">
              <div class="compositions-label">Compositions:</div>
              <div class="compositions-list">
                ${stats.agentCompositions.map(comp => `
                  <div class="composition">
                    <span class="comp-count">(${comp.count || '1'})</span>
                    <div class="agent-icons">
                      ${comp.agents.map(agent => `
                        <img src="${agent.image}" alt="${agent.name}" class="agent-icon" title="${agent.name}">
                      `).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        `;
        
        // Update the VLR link to point to the stats page with date range
        const vlrSection = card.querySelector('.vlr-section');
        if (vlrSection) {
          const vlrStatsUrl = generateVlrStatsUrl(teamId, dateRange);
          vlrSection.innerHTML = `<a href="${vlrStatsUrl}" target="_blank" class="vlr-link" title="VLR Stats">
            <img src="https://www.vlr.gg/img/vlr/logo_header.png" alt="VLR" class="vlr-icon">
          </a>`;
        }
        
        console.log(`Content: Updated stats for team ${teamId}`);
      }
    }
  });
}

// Function to fetch map data from Valorant API
async function fetchMapData() {
  if (mapDataCache) {
    return mapDataCache;
  }
  
  try {
    const response = await fetch('https://valorant-api.com/v1/maps');
    const data = await response.json();
    mapDataCache = data.data;
    console.log('Fetched map data:', mapDataCache);
    return mapDataCache;
  } catch (error) {
    console.error('Error fetching map data:', error);
    return [];
  }
}

// Function to get map info by MapID
async function getMapInfo(mapId) {
  const maps = await fetchMapData();
  const map = maps.find(m => {
    // Map the PRACC MapIDs to Valorant API map names
    const mapNames = {
      0: 'Haven',
      1: 'Bind', 
      2: 'Split',
      3: 'Ascent',
      4: 'Icebox',
      5: 'Breeze',
      6: 'Fracture',
      7: 'Pearl',
      8: 'Lotus',
      9: 'Sunset',
      10: 'Abyss',
      11: 'Corrode'
    };
    return m.displayName === mapNames[mapId];
  });
  
  return map || { displayName: 'Unknown Map', listViewIcon: null };
}

// Function to get specific maps list
function getSpecificMaps() {
  return [
    'Bind', 'Ascent', 'Haven', 'Split', 'Icebox', 'Breeze', 
    'Lotus', 'Sunset', 'Abyss', 'Corrode', 'Fracture', 'Pearl'
  ];
}

// Function to check if any maps are visible after loading
function checkVisibleMaps(teamId) {
  const mapsContainer = document.querySelector('.maps-container');
  if (!mapsContainer) return;
  
  const mapCards = mapsContainer.querySelectorAll(`[data-team-id="${teamId}"]`);
  const visibleMaps = Array.from(mapCards).filter(card => 
    card.style.display !== 'none' && !card.classList.contains('hidden')
  );
  
  if (visibleMaps.length === 0) {
    // No maps are visible, show the no data message
    const mapsGrid = mapsContainer.querySelector('.maps-grid');
    if (mapsGrid) {
      mapsGrid.innerHTML = `
        <div class="no-map-data">
          <h5>No Map Data in this Period</h5>
          <p>This team hasn't played any of the selected maps in the chosen time period.</p>
        </div>
      `;
    }
  }
}

// Function to get date range for VLR stats
function getDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  };
}

// Function to extract team ID from VLR link
function extractTeamIdFromVlrLink(vlrLink) {
  if (!vlrLink) return null;
  const match = vlrLink.match(/\/team\/(\d+)\//);
  return match ? match[1] : null;
}

// Function to fetch team stats from VLR.gg via background script
async function fetchTeamStats(teamId, mapName) {
  const cacheKey = `${teamId}_${mapName}_${dateRange}`;
  
  if (teamStatsCache.has(cacheKey)) {
    return teamStatsCache.get(cacheKey);
  }
  
  try {
    console.log(`Fetching team stats for team ${teamId} on ${mapName} via background script`);
    
    const message = {
      action: 'fetchVlrStats',
      teamId: teamId,
      mapName: mapName,
      dateRange: dateRange
    };
    
    console.log('Content: Sending message to background:', message);
    
    const response = await chrome.runtime.sendMessage(message);
    
    console.log('Content: Received response from background:', response);
    
    if (response && response.success) {
      teamStatsCache.set(cacheKey, response.data);
      return response.data;
    } else {
      console.error(`Error fetching team stats: ${response ? response.error : 'No response'}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching team stats for team ${teamId}:`, error);
    return null;
  }
}


// Function to check if a date is today
function isToday(dateString) {
  const matchDate = new Date(dateString);
  const today = new Date();
  
  // Set both dates to start of day for comparison
  matchDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  return matchDate.getTime() === today.getTime();
}

// Function to fetch matches data for today only
async function fetchMatches() {
  try {
    const response = await fetch('https://pracc.com/api/matches');
    const allMatches = await response.json();
    
    // Filter matches to only include today's matches
    const todayMatches = allMatches.filter(match => isToday(match.Time));
    
    console.log('Fetched all matches:', allMatches.length);
    console.log('Today\'s matches:', todayMatches.length);
    console.log('Today\'s matches data:', todayMatches);
    
    return todayMatches;
  } catch (error) {
    console.error('Error fetching matches:', error);
    return [];
  }
}

// Function to fetch team data
async function fetchTeamData(teamId) {
  try {
    const response = await fetch(`https://pracc.com/api/team/view/${teamId}`);
    const teamData = await response.json();
    console.log(`Fetched team data for ID ${teamId}:`, teamData);
    return teamData;
  } catch (error) {
    console.error(`Error fetching team data for ID ${teamId}:`, error);
    return null;
  }
}

// Function to extract VLR link from team data
function extractVlrLink(teamData) {
  if (teamData && teamData.Links) {
    const vlrLink = teamData.Links.find(link => link.Type === 'vlrgg');
    return vlrLink ? vlrLink.Url : null;
  }
  return null;
}

// Function to generate VLR stats URL with date range
function generateVlrStatsUrl(teamId, dateRange) {
  let startDateStr, endDateStr;
  
  // Check if custom date range is being used
  if (window.customDateRange) {
    startDateStr = window.customDateRange.start;
    endDateStr = window.customDateRange.end;
  } else {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);
    
    startDateStr = startDate.toISOString().split('T')[0];
    endDateStr = endDate.toISOString().split('T')[0];
  }
  
  return `https://www.vlr.gg/team/stats/${teamId}/?event_id=all&date_start=${startDateStr}&date_end=${endDateStr}`;
}

// Function to create the extension UI
function createExtensionUI() {
  // Remove existing UI if it exists
  const existingUI = document.getElementById('pracc-search-stats');
  if (existingUI) {
    existingUI.remove();
  }

  // Create main container
  const container = document.createElement('div');
  container.id = 'pracc-search-stats';
  
  container.innerHTML = `
    <div class="pracc-search-header">
      <div class="header-title-section">
        <h3>Opponents Performance</h3>
        <button id="fetch-teams-btn" class="fetch-btn">Fetch Teams</button>
      </div>
      <button id="close-search-stats" class="close-btn">×</button>
    </div>
    <div class="controls-section" id="controls-section" style="display: none;">
      <div class="team-selector" id="team-selector">
        <label for="team-picker">Team:</label>
        <select id="team-picker" class="team-picker-select">
          <option value="">Select a team...</option>
        </select>
      </div>
      <div class="date-range-selector">
        <label for="search-date-range">Period:</label>
        <select id="search-date-range" class="date-range-select">
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="custom">Custom Range</option>
        </select>
      </div>
      <div class="custom-date-range" id="custom-date-range" style="display: none;">
        <div class="date-input-group">
          <label for="start-date">From:</label>
          <input type="date" id="start-date" class="date-input">
        </div>
        <div class="date-input-group">
          <label for="end-date">To:</label>
          <input type="date" id="end-date" class="date-input">
        </div>
      </div>
    </div>
    <div id="search-stats-container" class="search-stats-container">
      <div class="welcome-message">
        <h4>Welcome to Opponents Performance</h4>
        <p>Click "Fetch Teams" to load available teams from today's matches.</p>
        <p>Then select a team to view their detailed statistics for each map.</p>
      </div>
    </div>
  `;

  // Insert the container at the top of the page
  const body = document.body;
  if (body) {
    body.insertBefore(container, body.firstChild);
  }

  // Make the container draggable
  makeDraggable(container);

  // Add event listeners
  const fetchBtn = document.getElementById('fetch-teams-btn');
  if (fetchBtn) {
    fetchBtn.addEventListener('click', () => {
      loadAndDisplayMatches();
      // Show controls section after fetching
      const controlsSection = document.getElementById('controls-section');
      if (controlsSection) {
        controlsSection.style.display = 'flex';
      }
    });
  }
  
  const closeBtn = document.getElementById('close-search-stats');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      container.remove();
    });
  }
  
  // Add event listener for date range selector
  const dateRangeSelect = document.getElementById('search-date-range');
  if (dateRangeSelect) {
    dateRangeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        const customRange = document.getElementById('custom-date-range');
        if (customRange) {
          customRange.style.display = 'flex';
        }
      } else {
        const customRange = document.getElementById('custom-date-range');
        if (customRange) {
          customRange.style.display = 'none';
        }
        window.customDateRange = null;
        // Reload teams if a team is selected
        const teamPicker = document.getElementById('team-picker');
        if (teamPicker && teamPicker.value) {
          const selectedTeamId = teamPicker.value;
          displaySelectedTeamStats(selectedTeamId);
        }
      }
    });
  }

  // Add event listeners for custom date inputs
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  
  if (startDateInput && endDateInput) {
    const updateCustomDateRange = () => {
      const startDate = startDateInput.value;
      const endDate = endDateInput.value;
      
      if (startDate && endDate) {
        window.customDateRange = {
          start: startDate,
          end: endDate
        };
        // Reload teams if a team is selected
        const teamPicker = document.getElementById('team-picker');
        if (teamPicker && teamPicker.value) {
          const selectedTeamId = teamPicker.value;
          displaySelectedTeamStats(selectedTeamId);
        }
      }
    };
    
    startDateInput.addEventListener('change', updateCustomDateRange);
    endDateInput.addEventListener('change', updateCustomDateRange);
  }

  // Add team picker event listener
  const teamPicker = document.getElementById('team-picker');
  if (teamPicker) {
    teamPicker.addEventListener('change', (e) => {
      const selectedTeamId = e.target.value;
      if (selectedTeamId) {
        displaySelectedTeamStats(selectedTeamId);
      } else {
        // Show welcome message when no team is selected
        const container = document.getElementById('search-stats-container');
        if (container) {
          container.innerHTML = `
            <div class="welcome-message">
              <h4>Welcome to Opponents Performance</h4>
              <p>Click "Fetch Teams" to load available teams from today's matches.</p>
              <p>Then select a team to view their detailed statistics for each map.</p>
            </div>
          `;
        }
      }
    });
  }
}

// Function to create a match card
async function createMatchCard(match, teamData) {
  const vlrLink = extractVlrLink(teamData);
  const matchTime = new Date(match.Time).toLocaleString();
  const mapInfo = await getMapInfo(match.MapID);
  const mapName = mapInfo.displayName;
  const mapIcon = mapInfo.listViewIcon;
  
  // Fetch team stats if VLR link is available
  let teamStats = null;
  let vlrStatsUrl = null;
  if (vlrLink) {
    const teamId = extractTeamIdFromVlrLink(vlrLink);
    if (teamId) {
      teamStats = await fetchTeamStats(teamId, mapName);
      vlrStatsUrl = generateVlrStatsUrl(teamId, dateRange);
    }
  }
  
  // Create the match card element
  const matchCard = document.createElement('div');
  matchCard.className = 'match-card';
  
  // Add team ID for later updates
  if (vlrLink) {
    const teamId = extractTeamIdFromVlrLink(vlrLink);
    if (teamId) {
      matchCard.setAttribute('data-team-id', teamId);
    }
  }
  
  matchCard.innerHTML = `
    <div class="team-info">
      <img src="${match.Logo}" alt="${match.TeamName}" class="team-logo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjIwIiB5PSIyMCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tk88L3RleHQ+Cjwvc3ZnPg=='">
      <div class="team-details">
        <h4 class="team-name">${match.TeamName}</h4>
        <p class="match-time">${matchTime}</p>
        <div class="match-map-container">
          ${mapIcon ? `
            <div class="map-icon-wrapper">
              <img src="${mapIcon}" alt="${mapName}" class="map-icon-bg">
              <span class="map-name-overlay">${mapName}</span>
            </div>
          ` : `
            <div class="match-map-fallback">
              🗺️ ${mapName}
            </div>
          `}
        </div>
        ${teamStats ? `
          <div class="team-stats">
            <div class="stats-row">
              <span class="stat-label">Win Rate:</span>
              <span class="stat-value">${teamStats.winRate}</span>
            </div>
            <div class="stats-row">
              <span class="stat-label">ATK:</span>
              <span class="stat-value">${teamStats.atkWinRate}</span>
              <span class="stat-label">DEF:</span>
              <span class="stat-value">${teamStats.defWinRate}</span>
            </div>
            ${teamStats.agentCompositions && teamStats.agentCompositions.length > 0 ? `
              <div class="agent-compositions">
                <div class="compositions-label">Compositions:</div>
                <div class="compositions-list">
                  ${teamStats.agentCompositions.map(comp => `
                    <div class="composition">
                      <span class="comp-count">(${comp.count})</span>
                      <div class="agent-icons">
                        ${comp.agents.map(agent => `
                          <img src="${agent.image}" alt="${agent.name}" class="agent-icon" title="${agent.name}">
                        `).join('')}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    </div>
    <div class="vlr-section">
      ${vlrStatsUrl ? 
        `<a href="${vlrStatsUrl}" target="_blank" class="vlr-link" title="VLR Stats">
          <img src="https://www.vlr.gg/img/vlr/logo_header.png" alt="VLR" class="vlr-icon">
        </a>` : 
        '<span class="no-vlr">No VLR</span>'
      }
    </div>
  `;
  
  return matchCard;
}

// Function to load and display matches
async function loadAndDisplayMatches() {
  const container = document.getElementById('search-stats-container');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading teams from today\'s matches...</div>';

  try {
    const matches = await fetchMatches();
    
    if (matches.length === 0) {
      container.innerHTML = '<div class="no-matches">No matches today</div>';
      return;
    }

    // Extract unique teams from matches
    const teamMap = new Map();
    
    for (const match of matches) {
      if (!teamMap.has(match.TeamID)) {
        const teamData = await fetchTeamData(match.TeamID);
        teamMap.set(match.TeamID, {
          team: teamData,
          region: 'unknown' // Matches don't have region info
        });
      }
    }

    // Populate team picker
    populateTeamPicker(teamMap);
    
    // Show success message
    container.innerHTML = `
      <div class="welcome-message">
        <h4>Teams loaded successfully!</h4>
        <p>Found ${teamMap.size} teams from today's matches.</p>
        <p>Select a team from the dropdown to view their detailed statistics.</p>
      </div>
    `;

  } catch (error) {
    console.error('Error loading matches:', error);
    container.innerHTML = '<div class="error">Error loading teams. Please try again.</div>';
  }
}

// Initialize the extension when the page loads
function init() {
  // Only initialize matches functionality on the matches page
  if (window.location.pathname.includes('/matches')) {
    // Wait for the page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        createExtensionUI();
        loadAndDisplayMatches();
      });
    } else {
      createExtensionUI();
      loadAndDisplayMatches();
    }
  } else if (isSearchPage) {
    console.log('PRACC Search page - API monitoring active');
    // Create the search stats UI immediately
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        createSearchStatsUI();
      });
    } else {
      createSearchStatsUI();
    }
  }
}

// Function to make elements draggable
function makeDraggable(element) {
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  const dragStart = (e) => {
    if (e.target.closest('button, select, input')) {
      return; // Don't drag if clicking on interactive elements
    }
    
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === element || element.contains(e.target)) {
      isDragging = true;
    }
  };

  const dragEnd = () => {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  };

  const drag = (e) => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      xOffset = currentX;
      yOffset = currentY;

      element.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  };

  element.addEventListener('mousedown', dragStart);
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('mousemove', drag);
}

// Start the extension
init();

