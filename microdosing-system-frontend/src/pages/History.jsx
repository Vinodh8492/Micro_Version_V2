import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const History = () => {
  const [dosingRecords, setDosingRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const printRef = useRef();

  const API_URL = 'http://127.0.0.1:5000';

  const fetchDosedMaterials = async (pageNum = 1) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/dosed_recipe_materials`, {
        params: { page: pageNum, per_page: 20 }
      });

      const data = response.data;
      console.log("data is :", data)

      if (!data || !Array.isArray(data.records)) {
        throw new Error("Invalid API response format");
      }

      setDosingRecords(data.records);
      setPages(data.pages || 1);
      setPage(data.page || 1);
      setError(null);
    } catch (err) {
      setError("Failed to fetch dosed materials.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDosedMaterials(page);
  }, [page]);

  const handlePrevPage = () => {
    if (page > 1) fetchDosedMaterials(page - 1);
  };

  const handleNextPage = () => {
    if (page < pages) fetchDosedMaterials(page + 1);
  };

  const handlePrint = () => {
    const printSection = printRef.current;
    const originalBody = document.body.innerHTML;
    const printContent = printSection.innerHTML;
    document.body.innerHTML = `<div>${printContent}</div>`;
    window.print();
    document.body.innerHTML = originalBody;
    window.location.reload();
  };

  const handleDeleteAllHistory = async () => {
    const result = await Swal.fire({
      title: '🗑 Delete All History?',
      text: "This will permanently remove all dosing records!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete all',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      const res = await axios.delete(`${API_URL}/api/dosed_recipe_materials/delete-all`);
      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: res.data.message,
        confirmButtonColor: '#16a34a'
      });
      fetchDosedMaterials(1); // refresh to show empty
    } catch (err) {
      console.error("❌ Delete failed:", err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to delete history. Please try again.',
        confirmButtonColor: '#ef4444'
      });
    }
  };

  const userData = JSON.parse(localStorage.getItem('user'));
  const userRole = userData?.role;
  console.log("user role :", userRole)

  return (
    <div ref={printRef} className="p-6 bg-white min-h-screen text-black">
      <h2 className="text-3xl font-bold mb-6">History - Dosed Materials</h2>

      <div className="flex justify-end mb-4 gap-4 print:hidden">
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          🖨 Print Table
        </button>
        {userRole === "admin" && (
          <button
            onClick={handleDeleteAllHistory}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            🗑 Delete All
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : dosingRecords.length === 0 ? (
        <p className="text-gray-700">No records found.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border bg-gray-200">
              <thead className="bg-gray-300 text-sm">
                <tr>
                  <th className="p-3 border">Recipe</th>
                  <th className="p-3 border">Material</th>
                  <th className="p-3 border">Set Point</th>
                  <th className="p-3 border">Actual</th>
                  <th className="p-3 border">Margin</th>
                  <th className="p-3 border">Batch Size</th>
                  <th className="p-3 border">Dosed At</th>
                </tr>
              </thead>
              <tbody>
                {dosingRecords.map((mat) => (
                  <tr key={mat.id} className="bg-white hover:bg-gray-100">
                    <td className="p-3 border">{mat.recipe_name}</td>
                    <td className="p-3 border">{mat.material_name}</td>
                    <td className="p-3 border">{mat.set_point}</td>
                    <td className="p-3 border">{mat.actual}</td>
                    <td className="p-3 border">{mat.margin}</td>
                    <td className="p-3 border">{mat.batch_size}</td>
                    <td className="p-3 border">{mat.dosed_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-4 print:hidden">
            <button
              onClick={handlePrevPage}
              disabled={page === 1}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {pages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={page === pages}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default History;
