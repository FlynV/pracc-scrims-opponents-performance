# Opponents Performance

A Chrome extension that provides detailed team performance statistics for PRACC matches and searches. Get comprehensive map stats, win rates, and agent compositions for your scrim opponents.

## Features

- **Dual Page Support**: Works on both `pracc.com/matches` and `pracc.com/search` pages
- **Team Performance Stats**: Detailed map statistics including win rates, attack/defense splits, and play counts
- **VLR.gg Integration**: Direct access to team VLR.gg pages with priority for teams with VLR data
- **Custom Date Ranges**: 30/90 day periods or custom date range selection
- **Map-Specific Data**: Statistics for all Valorant maps (Bind, Ascent, Haven, Split, Icebox, Breeze, Lotus, Sunset, Abyss, Corrode, Fracture, Pearl)
- **Agent Compositions**: View most used agent compositions for each team
- **Draggable Interface**: Move the stats modal anywhere on the page
- **Skeletal Loading**: Smooth loading animations to prevent UI jumps
- **Dark Theme**: Modern Shadcn-inspired dark mode design
- **Team Logos**: Visual team identification with logos in dropdowns
- **Smart Filtering**: Only shows maps that were actually played (play count > 0)

## Installation

1. Download or clone this repository
2. Open Google Chrome
3. Go to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extension folder
6. The extension will be installed and ready to use

## Usage

### For Matches Page
1. Navigate to `https://pracc.com/matches`
2. Click the extension icon and select "Load Stats Modal"
3. Click "Fetch Teams" to load teams from today's matches
4. Select a team from the dropdown to view their detailed statistics
5. Choose your preferred time period (30/90 days or custom range)

### For Search Page
1. Navigate to `https://pracc.com/search`
2. Click the extension icon and select "Load Stats Modal"
3. Click "Fetch Teams" to load teams from search results
4. Select a team from the dropdown to view their detailed statistics
5. Choose your preferred time period (30/90 days or custom range)

### Features
- **Team Selection**: Teams with VLR.gg data are prioritized and marked with a ⭐
- **Map Statistics**: View win rates, attack/defense splits, and play counts for each map
- **Agent Compositions**: See the most used agent compositions for each team
- **Custom Date Range**: Set specific start and end dates for statistics
- **Draggable Modal**: Click and drag the stats modal to move it around the page

## Files

- `manifest.json` - Extension configuration and permissions
- `content.js` - Main extension logic and UI management
- `styles.css` - Complete styling for dark theme and responsive design
- `popup.html` - Extension popup interface with compact instructions
- `popup.js` - Popup logic and modal loading functionality
- `background.js` - Background service worker for VLR.gg data fetching
- `README.md` - This file

## API Endpoints Used

- `https://pracc.com/api/matches` - Fetches current matches
- `https://pracc.com/api/team/view/{teamId}` - Fetches team details including VLR links
- `https://pracc.com/api/search` - Fetches search results for team discovery
- `https://www.vlr.gg/team/stats/{teamId}` - Fetches detailed team statistics from VLR.gg
- `https://valorant-api.com/v1/maps` - Fetches map information and icons

## Permissions

- `activeTab` - To detect when the extension is active
- `scripting` - To inject content scripts and execute functions
- `https://pracc.com/*` - To make API calls to PRACC
- `https://www.vlr.gg/*` - To fetch team statistics from VLR.gg
- `https://valorant-api.com/*` - To fetch map data and agent information

## Technical Features

- **Caching System**: Intelligent caching for team stats and map data to improve performance
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Responsive Design**: Works on various screen sizes with adaptive layouts
- **Performance Optimization**: Batch processing and loading states for smooth UX
- **Data Validation**: Robust data validation and fallback handling

## Development

The extension uses vanilla JavaScript and CSS with modern ES6+ features. No external dependencies are required.

## Creator

Created by [@FlynVAL](https://x.com/FlynVAL) on X (Twitter)

## License

This project is for educational purposes.
