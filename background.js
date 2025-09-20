// Background script to handle VLR.gg requests and bypass CORS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background: Received message:', request);
  
  if (request.action === 'test') {
    console.log('Background: Test message received');
    sendResponse({ success: true, message: 'Background script is working' });
      } else if (request.action === 'fetchVlrStats') {
        console.log('Background: Processing fetchVlrStats request');
        
        // Fetch the stats and send response
        fetchVlrStats(request.teamId, request.mapName, request.dateRange)
          .then(stats => {
            console.log('Background: Stats fetched successfully:', stats);
            sendResponse({ success: true, data: stats });
          })
          .catch(error => {
            console.error('Background: Error fetching stats:', error);
            sendResponse({ success: false, error: error.message });
          });
        
        return true; // Keep the message channel open for async response
  } else {
    console.log('Background: Unknown action:', request.action);
    sendResponse({ success: false, error: 'Unknown action' });
  }
});

async function fetchVlrStats(teamId, mapName, dateRange) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const url = `https://www.vlr.gg/team/stats/${teamId}/?event_id=all&date_start=${startDateStr}&date_end=${endDateStr}`;
    
    console.log(`Background: Fetching VLR stats for team ${teamId} on ${mapName}:`, url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`Background: Received HTML response, length: ${html.length}`);
    
    // Log a snippet of the HTML to see what we're working with
    console.log('Background: HTML snippet (first 1000 chars):', html.substring(0, 1000));
    
    // Parse the HTML to extract map stats
    const stats = parseTeamStatsFromHTML(html, mapName);
    console.log(`Background: Parsed stats for ${mapName}:`, stats);
    
    return stats;
  } catch (error) {
    console.error('Background: Error fetching VLR stats:', error);
    throw error;
  }
}

function parseTeamStatsFromHTML(html, mapName) {
  try {
    console.log(`Background: Parsing HTML for map: ${mapName}`);
    console.log(`Background: HTML length: ${html.length}`);
    
    // Use regex to find the table and extract map stats
    // Look for the table that contains map statistics
    const tableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
    if (!tableMatch) {
      console.log('Background: No table found in HTML');
      return null;
    }
    
    console.log(`Background: Found ${tableMatch.length} tables in HTML`);
    
    // Look for the stats table (usually the first one with map data)
    let statsTable = null;
    for (const table of tableMatch) {
      if (table.includes('Map') && table.includes('WIN%')) {
        statsTable = table;
        break;
      }
    }
    
    if (!statsTable) {
      console.log('Background: No stats table found');
      return null;
    }
    
    console.log('Background: Found stats table, searching for map rows...');
    
    // Extract table rows using regex
    const rowMatches = statsTable.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
    if (!rowMatches) {
      console.log('Background: No rows found in stats table');
      return null;
    }
    
    console.log(`Background: Found ${rowMatches.length} rows in stats table`);
    
    let mapStats = null;
    
        // Log all map names found in the table
        console.log('Background: Available maps in table:');
        for (let i = 0; i < rowMatches.length; i++) {
          const row = rowMatches[i];
          // Look for map name pattern in the first cell
          const firstCellMatch = row.match(/<td[^>]*>[\s\S]*?([A-Za-z\s]+)\s*\([0-9]+\)[\s\S]*?<\/td>/);
          if (firstCellMatch) {
            const cellText = firstCellMatch[1].trim();
            if (cellText && cellText.length > 0) {
              console.log(`  Row ${i}: "${cellText}"`);
            }
          }
        }
    
        // Look for the specific map
        for (const row of rowMatches) {
          // Look for map name pattern in the first cell with play count
          const firstCellMatch = row.match(/<td[^>]*>[\s\S]*?([A-Za-z\s]+)\s*\(([0-9]+)\)[\s\S]*?<\/td>/);
          if (firstCellMatch) {
            const cellText = firstCellMatch[1].trim();
            const playCount = parseInt(firstCellMatch[2]) || 0;
            console.log(`Background: Checking row: "${cellText}" (${playCount} plays)`);
            
            if (cellText.toLowerCase().includes(mapName.toLowerCase())) {
              console.log(`Background: Found matching row for ${mapName} with ${playCount} plays`);
              
              // Extract all cell values from this row using a more robust regex
              const cellMatches = row.match(/<td[^>]*>[\s\S]*?<\/td>/g);
              if (cellMatches && cellMatches.length >= 7) {
                const cells = cellMatches.map((cell, index) => {
                  // Look for the actual value inside mod-first divs
                  const valueMatch = cell.match(/<div class="mod-first[^"]*"[^>]*>([^<]*)<\/div>/);
                  if (valueMatch) {
                    const cleanText = valueMatch[1].trim();
                    console.log(`Background: Cell ${index}: "${cleanText}"`);
                    return cleanText;
                  }
                  // Fallback: try to extract any text content
                  const textMatch = cell.match(/<td[^>]*>([\s\S]*?)<\/td>/);
                  if (textMatch) {
                    const cleanText = textMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                    console.log(`Background: Cell ${index} (fallback): "${cleanText}"`);
                    return cleanText;
                  }
                  console.log(`Background: Cell ${index}: No text found`);
                  return '';
                });
                
                console.log(`Background: Row has ${cells.length} cells:`, cells);
                
                // Extract agent compositions from the last cell
                const agentCompositions = extractAgentCompositions(row);
                
                mapStats = {
                  map: mapName,
                  playCount: playCount,
                  winRate: cells[2] || 'N/A',        // Index 2: "50%" - Win Rate
                  atkWinRate: cells[7] || 'N/A',     // Index 7: "42%" - ATK Round Win Rate
                  defWinRate: cells[10] || 'N/A',    // Index 10: "47%" - DEF Round Win Rate
                  agentCompositions: agentCompositions
                };
                console.log('Background: Parsed stats:', mapStats);
                break;
              }
            }
          }
        }
    
    if (!mapStats) {
      console.log(`Background: No stats found for map: ${mapName}`);
    }
    
    return mapStats;
  } catch (error) {
    console.error('Background: Error parsing team stats HTML:', error);
    return null;
  }
}

function extractAgentCompositions(row) {
  try {
    console.log('Background: Extracting agent compositions from row');
    
    // Find all agent composition divs in the row
    const agentCompMatches = row.match(/<div class="agent-comp-agg[^"]*"[^>]*>[\s\S]*?<\/div>/gi);
    if (!agentCompMatches) {
      console.log('Background: No agent compositions found');
      return [];
    }
    
    console.log(`Background: Found ${agentCompMatches.length} agent compositions`);
    
    const compositions = [];
    
    for (const compDiv of agentCompMatches) {
      // Extract the count/usage number from span or div
      let count = '1';
      const countMatch = compDiv.match(/<span[^>]*>([^<]*)<\/span>/) || compDiv.match(/<div[^>]*>([^<]*)<\/div>/);
      if (countMatch) {
        count = countMatch[1].trim() || '1';
      }
      
      // Extract agent images
      const agentMatches = compDiv.match(/<img[^>]*src="[^"]*\/agents\/([^"]+)\.png"[^>]*>/gi);
      const agents = [];
      
      if (agentMatches) {
        for (const agentImg of agentMatches) {
          const agentMatch = agentImg.match(/\/agents\/([^"]+)\.png/);
          if (agentMatch) {
            const agentName = agentMatch[1];
            agents.push({
              name: agentName,
              image: `https://www.vlr.gg/img/vlr/game/agents/${agentName}.png`
            });
          }
        }
      }
      
      if (agents.length > 0) {
        compositions.push({
          count: count,
          agents: agents
        });
      }
    }
    
    console.log('Background: Extracted compositions:', compositions);
    return compositions;
  } catch (error) {
    console.error('Background: Error extracting agent compositions:', error);
    return [];
  }
}
