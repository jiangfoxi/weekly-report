-- Usage: osascript fetch-notes.applescript <daysBack>
-- Outputs notes modified within the last <daysBack> days
-- Uses a record separator to avoid slow character-by-character JSON escaping
-- Format per note: TITLE\x1CBODY_TRUNCATED\x1CDATE\x1CFOLDER\x1E

on run argv
	set daysBack to 14
	if (count of argv) > 0 then
		set daysBack to (item 1 of argv) as integer
	end if

	set cutoffDate to (current date) - (daysBack * days)
	set fieldSep to (ASCII character 28) -- FS
	set recSep to (ASCII character 30) -- RS
	set output to ""

	tell application "Notes"
		set recentNotes to every note whose modification date >= cutoffDate
		repeat with aNote in recentNotes
			set noteTitle to name of aNote
			-- Truncate body to avoid slow processing of huge HTML bodies
			set noteBody to body of aNote
			if length of noteBody > 2000 then
				set noteBody to text 1 thru 2000 of noteBody
			end if
			set noteModDate to modification date of aNote
			set folderName to ""
			try
				set folderName to name of container of aNote
			end try

			set isoMod to my isoDate(noteModDate)
			set output to output & noteTitle & fieldSep & noteBody & fieldSep & isoMod & fieldSep & folderName & recSep
		end repeat
	end tell

	return output
end run

on isoDate(d)
	set y to year of d as string
	set mo to (month of d as integer) as string
	if length of mo < 2 then set mo to "0" & mo
	set dy to day of d as string
	if length of dy < 2 then set dy to "0" & dy
	set h to hours of d as string
	if length of h < 2 then set h to "0" & h
	set mi to minutes of d as string
	if length of mi < 2 then set mi to "0" & mi
	set s to seconds of d as string
	if length of s < 2 then set s to "0" & s
	return y & "-" & mo & "-" & dy & "T" & h & ":" & mi & ":" & s & "+08:00"
end isoDate
