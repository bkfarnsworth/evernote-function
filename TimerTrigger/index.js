const Evernote = require('evernote');
const enml = require('enml-js');
const axios = require('axios');

module.exports = async function (context, myTimer) {

    let payload;
    try {
        //get random note from evernote
        const noteString = await doEvernoteStuff();
        payload = noteString;

    } catch (e) {

        if(e.errorCode === 9 && e.parameter === 'authenticationToken') {
            payload = 'Your prod token expired (it does after one year) follow these steps to update: '
        } else {
            payload = JSON.stringify(e);
        }
    }

    //send payload to slack
    const responseData = await sendStringToSlack(payload);
    if(responseData !== 'ok') {
        await sendStringToSlack('slack post failed with code: ' + responseData);
    }
};

async function sendStringToSlack(str) {

    const response = await axios({
        url: process.env.SLACK_URL,
        method: 'post',
        headers: {
            'Content-type': 'application/json',
            'Accept': 'application/json'
        },
        data: {text: str}
    });

    return response.data;
}

async function doEvernoteStuff() {

    const client = new Evernote.Client({
        token: process.env.EVERNOTE_PROD_TOKEN,

        //expired token for testing errors
        // token: 'S=s208:U=2cd92e8:E=16618c79b27:C=15ec1166d10:P=1cd:A=en-devtoken:V=2:H=d2b3d0fac6250bc4c4db30b9a35859b2',

        //malformed token for testing errors
        // token: 'S=s208:U=2cd92e8:E=16618c72:H=d2b3d0fac6250bc4c4db30b9a35859b2',
        sandbox: false,
        china: false
    });
    const noteStore = client.getNoteStore();
    const filter = new Evernote.NoteStore.NoteFilter()
    filter.order = Evernote.Types.NoteSortOrder.CREATED;
    filter.notebookGuid = "a5c3eeeb-72d4-41b0-8621-08d7a00d3adb";//guid for the reminders notebook
    const spec = Evernote.NoteStore.NotesMetadataResultSpec({
        includeTitle: true,
        includeContentLength: false,
        includeNotebookGuid: true,
        includeAttributes: true,
        includeLargestResourceMime: true,
        includeLargestResourceSize: true,
    });

    //just get the metaData for the first note so we can get the total number of notes
    const notesMetadataList = await noteStore.findNotesMetadata(filter, 0, 1, spec);

    //now get a random number between 0 and the total number of notes      
    const totalNotes = notesMetadataList.totalNotes;
    const randomNumber = getRandomInt(0, totalNotes);

    //now get the meta data for the note of that random number
    const list = await noteStore.findNotesMetadata(filter, randomNumber, randomNumber + 1, spec);

    //get the note with it's content
    const notes = list.notes;
    const note = notes[0];
    if(note) {
        const noteResultSpec = new Evernote.NoteStore.NoteResultSpec({
            includeContent: true
        });

        const wholeNote = await noteStore.getNoteWithResultSpec(note.guid, noteResultSpec)
        const content = wholeNote.content;
        const plainText = enml.PlainTextOfENML(content);
        // console.log("plainText: ", plainText);

        //for debugging, the content looks like this:
        // <?xml version="1.0" encoding="UTF-8" standalone="no"?>
        // <!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
        // <en-note><div>&quot;Clarification chain&quot;</div><div><br/></div><div>'If it matters at all, it is detectable/observable'</div><div>If it is is detectable, it can be detected as an amount (or a range of possible amounts)</div><div>If it can be detected as a range of possible amounts, it is measurable</div><div><br/></div></en-note>

        return plainText;
    }
}


// This example returns a random integer between the specified values. The value is no lower than min (or the next integer greater than min if min isn't an integer), and is less than (but not equal to) max.
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
 }