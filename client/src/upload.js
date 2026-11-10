// "Make your own castle" screen. Interface only: nothing is uploaded or processed yet.
import './upload.css';

const KINDS = ["Grandma's story", 'Class recording', 'Podcast', 'Voice note'];
const STEPS = [
  ['Listen', 'Deepgram writes down every word.'],
  ['Learn', 'We find the big ideas and story moments.'],
  ['Play', 'Your castle opens with new characters and puzzles.'],
];

function buildDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'makeDialog';
  dialog.innerHTML = `
    <form method="dialog" class="makeForm" novalidate>
      <h2>Turn anything into a castle</h2>
      <p class="makeIntro">Share a story, a lesson or a podcast. It becomes a castle full of characters and puzzles.</p>

      <fieldset class="makeKinds">
        <legend>What are you sharing?</legend>
        ${KINDS.map((kind, i) => `<label><input type="radio" name="kind" value="${kind}" ${i === 0 ? 'checked' : ''} /><span>${kind}</span></label>`).join('')}
      </fieldset>

      <label class="makeField">
        <span>Paste a link to a video or podcast</span>
        <input id="makeLink" type="url" inputmode="url" placeholder="https://" autocomplete="off" />
      </label>

      <label class="makeDrop" id="makeDrop">
        <input id="makeFile" type="file" accept="audio/*,video/*" />
        <b id="makeFileName">Drop a video or audio file here</b>
        <small>Or click to choose one</small>
      </label>

      <ol class="makeSteps">
        ${STEPS.map(([name, text]) => `<li><b>${name}</b><span>${text}</span></li>`).join('')}
      </ol>

      <p id="makeStatus" class="makeStatus" role="status"></p>
      <div class="makeActions">
        <button type="button" id="makeBuild">Build my castle</button>
        <button type="button" id="makeClose" class="quiet">Close</button>
      </div>
    </form>`;
  document.body.append(dialog);

  const $ = (selector) => dialog.querySelector(selector);
  const fileName = $('#makeFileName');
  const status = $('#makeStatus');

  const showFile = (file) => {
    fileName.textContent = file ? file.name : 'Drop a video or audio file here';
    status.textContent = '';
  };

  $('#makeFile').addEventListener('change', (e) => showFile(e.target.files[0]));

  const drop = $('#makeDrop');
  for (const type of ['dragenter', 'dragover']) {
    drop.addEventListener(type, (e) => {
      e.preventDefault();
      drop.dataset.over = 'true';
    });
  }
  for (const type of ['dragleave', 'drop']) {
    drop.addEventListener(type, (e) => {
      e.preventDefault();
      drop.dataset.over = 'false';
    });
  }
  drop.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    $('#makeFile').files = e.dataTransfer.files;
    showFile(file);
  });

  $('#makeBuild').addEventListener('click', () => {
    const hasSource = $('#makeLink').value.trim() || $('#makeFile').files.length;
    status.dataset.tone = hasSource ? 'info' : 'error';
    status.textContent = hasSource
      ? 'Preview only. Castle building is not connected yet, and nothing was uploaded.'
      : 'Paste a link or choose a file first.';
  });
  $('#makeClose').addEventListener('click', () => dialog.close());
  return dialog;
}

addEventListener('DOMContentLoaded', () => {
  const dialog = buildDialog();
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'subject makeOwn';
  card.innerHTML = `
    <span class="makeIcon" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
    <span><b>Make your own castle</b><small>From a story, class recording, podcast or video</small></span>`;
  card.addEventListener('click', () => dialog.showModal());
  document.querySelector('.subjects')?.append(card);
});
