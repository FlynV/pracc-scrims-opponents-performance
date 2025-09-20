# PRACC Matches VLR Extension

A Chrome extension that enhances the PRACC matches page by displaying team logos and VLR.gg links for each match.

## Features

- Automatically loads when visiting `pracc.com/matches`
- Fetches live match data from the PRACC API for today only
- Displays team logos and information for current day's matches
- Provides direct links to VLR.gg team pages
- Responsive design that works on desktop and mobile
- Real-time data refresh functionality

## Installation

1. Download or clone this repository
2. Open Google Chrome
3. Go to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extension folder
6. The extension will be installed and ready to use

## Usage

1. Navigate to `https://pracc.com/matches`
2. The extension will automatically load and display today's match information
3. Click on "View on VLR.gg" links to visit team pages
4. Use the refresh button to update the data

## Files

- `manifest.json` - Extension configuration
- `content.js` - Main extension logic
- `styles.css` - Extension styling
- `popup.html` - Extension popup interface
- `README.md` - This file

## API Endpoints Used

- `https://pracc.com/api/matches` - Fetches current matches
- `https://pracc.com/api/team/view/{teamId}` - Fetches team details including VLR links

## Permissions

- `activeTab` - To detect when the extension is active
- `scripting` - To inject content scripts
- `https://pracc.com/*` - To make API calls to PRACC

## Development

The extension uses vanilla JavaScript and CSS. No external dependencies are required.

## License

This project is for educational purposes.
