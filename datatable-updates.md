# Datatable Updates

The following is a list of updates and changes made to the datatable component. For this task, please thoroughly review the list and the existing codebase. When you are done, add a section below each named `### Clarifying Questions` and add a list of any questions you have about the request in order to accurately implement the changes if any of the following requests are not clear. If the request is clear and you don't need more information, then in the `### Clarifying Questions` section, write "No clarifying questions at this time." Do NOT implement any of the code changes until you have completed the `### Clarifying Questions` section and I have reviewed your questions. I will then provide answers to your questions and you can proceed with the implementation.

**IMPORTANT NOTE:**

I added the `video-audit` project to this workspace. It's the original version of this app built for browser use. In that repo, the datatable had features that are not implemented in the current version of the `collie-video` app yet, but I need them implemented. I added `video-audit` to this workspace so you can refer to the code in that repo for reference on how to implement the features outlined in the updates below. Please refer to the `video-audit` repo as needed while implementing the changes below. But ONLY make the changes to the datatable in the `collie-video` app and do NOT make any changes to the `video-audit` repo. The `video-audit` repo is only for reference. And ONLY make the changes requested below. So if I didn't explicitly request a change, then do not make that change even if you see it in the `video-audit` repo. Only implement the changes outlined in the updates below.

## Update 1: File Column Changes

1. Rename the "File" column to "File Name".

2. Remove the extension from the file names in the "File Name" column (for the `span title` element). For example, "Roger Federer Greatest Shots.mp4" should be displayed as "Roger Federer Greatest Shots".

3a. Remove the leading path from the displayed path in the "File Name" column (for the `span small` element) up to the folder that the user selected as the root folder to do their audit scan. For example, if the user selected the folder `/Volumes/SanDisk SSD/Videos/Edited` as the root folder for their audit scan, then the displayed path in the table below the file name should start with `Edited/` and not include the leading path of `/Volumes/SanDisk SSD/Videos/`.

3b. Trim the path from the displayed path in the "File Name" column (for the `span small` element) so it shows the path all the way up to the highest level shared directory across files. For example (and in this example, the user selected `/Volumes/SanDisk SSD/Videos/Edited/Sports` as the root folder to scan. So the app will treat `/Sports/` as the root for displaying the path in the datatable). So if there are two videos, one with the file path `/Edited/Sports/Tennis/Wimbledon` and another with the file path `/Edited/Sports/Tennis/US Open`, the displayed path for both videos should be `/Edited/Sports/Tennis`.

### Acceptance Criteria

- The "File" column is renamed to "File Name".
- The root folder of the path in the "File Name" column is determined based on the user's selection and is displayed correctly according to the rules outlined in points 3a and 3b.
  - ***IMPORTANT:*** The changes to the path name are **ONLY** for display purposes in the datatable. The actual file paths used in the code and for any file operations should remain unchanged. And in the video details modal, the file path should also remain unchanged and show the full path.

## Update 2: Add Column Filters

The following columns should have filters added to them right underneath the column header

- File Name (text filter. Can be file name, path, or both)
- Type (multiselect dropdown filter with options for each file type that is present in the datatable)
- Size (multiselect dropdown filter with options for different size ranges. **NOTE:** Refer to the `video-audit` repo for reference on how to implement the size filter options, as well as the logic for filtering by size range/different range options)
- Duration (multiselect dropdown filter with options for different duration ranges. **NOTE:** Refer to the `video-audit` repo for reference on how to implement the duration filter options, as well as the logic for filtering by duration range/different range options)
- Modified (multiselect dropdown filter with options for different modified date ranges. **NOTE:** This is not in the `video-audit` repo, but you can implement it using the same logic as the size and duration filters. The options for the modified date filter should be: "Last 7 days", "Last 30 days", "Last 90 days", "Last 180 days", "Last 365 days", "More than 365 days ago")
- For the rest of the columns, implement filters the same way the same column filters are implemented in the `video-audit` repo. If a column has a filter in the `video-audit` repo, then implement that same filter type and logic and option groups for that column in the `collie-video` app. If a column does not have a filter in the `video-audit` repo, then use your best judgment (e.g. "Issues" column could probably benefit from a multiselect dropdown filter. But the Actions column probably doesn't need a filter since it only has buttons in it and no actual data to filter by).