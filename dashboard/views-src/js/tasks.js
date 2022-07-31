import $ from 'jquery';
import dt from 'datatables.net-dt';
import * as dayjs from 'dayjs';
dt();
import 'datatables.net-dt/css/jquery.dataTables.css';

//$('#list').DataTable();
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const refreshInterval = urlParams.get('refreshInterval') || 30000
if (urlParams.get('refresh')) {
  window.setTimeout(function () {
    window.location.reload();
  }, refreshInterval);
}

let tasksTable;

function loadTable () {
  tasksTable = $('#list').DataTable({
    // data: data,
    ajax: './api/tasks',
    columns: [
      {title: 'uuid', uuid: 'uuid', data: 'uuid',
        render: colorJobId
      },
      {title: 'Created', defaultContent: '',
        data: function (rec) {
          return rec.status.created || rec.created
        },
        render: formatDate
      },
      // {title: 'Updated', visible: false, defaultContent: '',
      //   data: function (rec) {
      //     let updates = [rec.created]
      //     updates = updates.concat(Object.values(rec.status))
      //     updates.sort().reverse()
      //     return updates[0]
      //   },
      //   render: formatDate
      // },
      {title: 'Job', data: 'job', defaultContent: ''},
      {title: 'Added To Queue', data: 'status.addedToQueue', defaultContent: '', render: formatDate, visible: false},
      {title: 'Started', data: 'status.started', defaultContent: '', render: formatDate},
      {title: 'Stopped', data: 'status.stopped', defaultContent: '-', render: formatDate},
      {title: 'Failed', data: 'status.failed', defaultContent: '-', render: formatDate},
      {title: 'Completed', data: 'status.completed', defaultContent: '-', render: formatDate},
      {title: 'Message',
        data: function (rec) {
          return rec.message || (rec.error && rec.error.message) || rec.error || '-'
        },
        defaultContent: '-'
      },
      {
        "className":      'details-control',
        "orderable":      false,
        "data":           null,
        "defaultContent": '<input type="button" class="btn" value="More"> <input class="btn" type="button" value="Stop">'
      }
    ],
    order: [[ 1, "desc" ]],
    columnDefs:[{
      targets: '_all',
      createdCell: formatStatus
    }]
  })

  $('#tblTasks tbody').on('click', 'td.details-control .btn', function () {
    var tr = $(this).closest('tr');
    var row = tasksTable.row( tr );
    var btn = this;
    var action = $(this).val().toLowerCase();
    if (action === 'stop') {
      console.log('will stop the task');
      stopTask(row.data());
    } else if (/(more|less)/.test(action)) {
      // var btn = $(this).find('input') 
      if ( row.child.isShown() ) {
        // This row is already open - close it
        row.child.hide();
        tr.removeClass('shown');
        $(btn).val('More')
      }
      else {
        // Open this row
        //row.child( format(row.data()) ).show();
        row.child('<pre> ' + JSON.stringify(row.data(), null, 4) + '</pre>').show();
        tr.addClass('shown');
        $(btn).val('Less')
      }
    }
  } );
}

// render function to format date
function formatDate (data, type, row) {
  if (data === '-') return data
  return data ? dayjs(data).format() : ''
}

function colorJobId (data, type, row) {
  let color
  if (row.status.completed) color = '#03a652'
  else if (row.status.failed || row.status.stopped) color = 'red'
  else if (row.status.started) color = '#444da3'
  else if (row.status.addedToQueue) color = '#fdaf16'
  if (color) return `<span style="color:${color};font-weight:bold;">${data}</span>`
  else return data
}

// createCell functions
function formatStatus (td, data, rowData, row, col) {
  if (data === 'done') $(td).css('color', 'green')
  if (data === 'error') $(td).css('color', 'red')
  if (data === 'running') $(td).css('color', 'orange')
}

loadTable();
