import $ from 'jquery';

module.exports = function (taskTable) {
  // from https://www.codexworld.com/simple-modal-popup-javascript-css/
  // Select modal
  const mpopup = document.getElementById('modalAddTask');

  // Select trigger link
  const mpLink = document.getElementById("addTaskLink");

  // Select close action element
  const close = document.getElementsByClassName("close")[0];

  // Open modal once the link is clicked
  mpLink.onclick = async function() {
    const workers = await getWorkers();
    mpopup.style.display = "block";
    populateWorkers(workers);
  };

  // Close modal once close element is clicked
  close.onclick = function() {
    mpopup.style.display = "none";
  };

  // Close modal when user clicks outside of the modal box
  window.onclick = function(event) {
    if (event.target == mpopup) {
      mpopup.style.display = "none";
    }
  };

  // select submit action element
  const btnSubmit = document.getElementById('btnSubmit');
  btnSubmit.onclick = async () => {
    await postTask();
  }

  // get workers list
  async function getWorkers () {
    return new Promise((resolve, reject) => {
      $.ajax({
        method: 'GET',
        url: './api/workers'
      }).done((data) => {
        console.log(JSON.stringify(data));
        resolve(data);
      }).fail((resp) => {
        console.error('Error: ', resp.message);
        reject(new Error(resp.message));
      })
    })
  }

  function populateWorkers (list) {
    $('#selWorker').html('');
    list.forEach(worker => {
      $('#selWorker')
        .append(`<option value="${worker.name}">${worker.name}</options>`);
    });
  }

  async function postTask () {
    const worker = $('#selWorker').val();
    const when = $('#txtWhen').val();
    const data = $('#taData').val();
    $.ajax({
      url: './api/tasks',
      method: 'POST',
      data: JSON.stringify({
        worker, when,
        data: JSON.parse(data)
      }),
      contentType: 'application/json',
      dataType: 'json'
    }).done(data => {
      //owStatus(null, data.message);
      alert(data.message);
      taskTable.ajax.reload(null, false);
      mpopup.style.display = "none";
    }).fail((a,b, error) => {
      alert(data.message);
    })
  }
}
