import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Orders from './Orders';
import { useDosing } from './DosingContext';
import Topbar from './Topbar';
import { useTopbar } from './TopbarContext';
import { useTheme } from "../context/ThemeContext";
import ScaleBar from './ScaleBar';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';

const ActiveOrders = () => {
  const [order, setOrder] = useState({
    materials: [],
    recipe_name: ''
  });
  const [currentMaterial, setCurrentMaterial] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actualValue, setActualValue] = useState(null);
  const [barcodeMatched, setBarcodeMatched] = useState(false);
  const [scannedDisplay, setScannedDisplay] = useState('');
  const [showMismatchPopup, setShowMismatchPopup] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [showScalePopup, setShowScalePopup] = useState(false);
  const [scaleStatus, setScaleStatus] = useState("");
  const [indicatorWidth, setIndicatorWidth] = useState(0);
  const [scanning, setScanning] = useState(false);
  const currentMaterialRef = useRef(null);
  const hasScanStartedRef = useRef(false);
  const firstScanRef = useRef(true);  // ✅ Track if this is the first scan in batch
  

  const socket = useRef(null);
  const barcodeRefs = useRef({});
  const overlayBarcodeRef = useRef(null);
  const scannedCodeRef = useRef('');
  const { addDosingRecord } = useDosing();
  const { setReqWeight } = useTopbar();
  const { themeColor } = useTheme();

  useEffect(() => {
  currentMaterialRef.current = currentMaterial;
}, [currentMaterial]);

useEffect(() => {
  const fetchActiveMaterial = async () => {
    try {
      // ✅ Check for an active material first
      const activeResponse = await axios.get('http://127.0.0.1:5000/api/recipe_materials/active');
      const rawMaterial = activeResponse.data;
      console.log("raw material :", rawMaterial)

      if (rawMaterial?.recipe_name) {
        const transformedMaterial = {
          id: rawMaterial.material_id,
          title: rawMaterial.material_name,
          barcode: rawMaterial.barcode,
          setPoint: parseFloat(rawMaterial.set_point),
          actual: parseFloat(rawMaterial.actual),
          unit: '',
          recipe: rawMaterial.recipe_name,
           recipe_id: rawMaterial.recipe_id, // ✅ Add this line
          dosed: false,
          margin: rawMaterial.margin,
          status: rawMaterial.status,
        };

        setOrder({
  materials: [{
    ...transformedMaterial,
    recipe_id: rawMaterial.recipe_id, // ✅ MUST be added to the material
  }],
  recipe_name: rawMaterial.recipe_name,
});
        return;
      }

      // ✅ No active material, fallback to full list
      const recipeResponse = await axios.get('http://127.0.0.1:5000/api/recipe_materials');
      const recipeMaterials = recipeResponse.data.materials || [];

      const enrichedMaterials = await Promise.all(
        recipeMaterials.map(async (mat, idx) => {
          if (!mat.recipe_id || !mat.material_id) {
            console.warn(`⚠️ Skipping material with missing IDs:`, mat);
            return null;
          }

          try {
            const [recipeRes, materialRes] = await Promise.all([
              axios.get(`http://127.0.0.1:5000/api/recipes/${mat.recipe_id}`),
              axios.get(`http://127.0.0.1:5000/api/materials/${mat.material_id}`),
            ]);

            return {
              id: mat.recipe_material_id || idx + 1,
              title: materialRes.data?.title || `Material #${mat.material_id}`,
              recipeName: recipeRes.data?.name || `Recipe #${mat.recipe_id}`,
              barcode: materialRes.data?.barcode_id,
              setPoint: mat.set_point,
              actual: mat.actual,
              unit: materialRes.data?.unit_of_measure || '',
              status: mat.status,
              dosed: false,
              margin: materialRes.data?.margin,
              recipe_id: mat.recipe_id,   // ✅ FIX HERE
            };
          } catch (innerErr) {
            console.error(`❌ Failed to fetch recipe or material info for material_id=${mat.material_id}, recipe_id=${mat.recipe_id}:`, innerErr.response?.data || innerErr.message);
            return null;
          }
        })
      );

     const validMaterials = enrichedMaterials.filter(Boolean);
const firstPending = recipeMaterials.find(mat => mat.status === 'pending');
const fullDetails = validMaterials.find(
  m => m.recipe_id === firstPending?.recipe_id && m.title === firstPending?.material_name
);

if (firstPending && fullDetails) {
  setOrder({
    materials: [{
      ...fullDetails,
      recipe_id: firstPending.recipe_id  // ✅ inject it manually here
    }],
    recipe_name: fullDetails.recipeName || 'Formula A',
  });
} else {
  setOrder({ materials: [], recipe_name: '' });
}

   } catch (error) {
    console.error("❌ Error fetching materials:", error);
    alert(`Error fetching materials: ${error.message}`);
  }
  };

  fetchActiveMaterial();

  socket.current = io('http://127.0.0.1:5000');

  // ✅ Refresh on new order creation
  socket.current.on('order_created', () => {
    
    fetchActiveMaterial();
  });
  // ✅ Refresh on order deletion
socket.current.on('order_deleted', (data) => {
  

  // If current material belongs to the deleted order's recipe, refresh
  if (currentMaterialRef.current?.recipe_id === data.recipe_id) {
    Swal.fire({
      title: "⚠️ Active Order Deleted",
      text: "The current active production order was deleted. Refreshing materials...",
      icon: "info",
      timer: 2500,
      showConfirmButton: false
    });
    fetchActiveMaterial();
  }
});



  // // ✅ Update local material state on dosing update
  // socket.current.on('recipe_material_updated', (updatedMaterial) => {
  //   setOrder(prevState => {
  //     const updatedMaterials = prevState.materials.map(material =>
  //       material.id === updatedMaterial.material_id
  //         ? { ...material, ...updatedMaterial }
  //         : material
  //     );
  //     return { ...prevState, materials: updatedMaterials };
  //   });
  // });

  // ✅ Handle barcode scanned event
  // ✅ Handle barcode scanned event
socket.current.on('barcode_scanned', async (data) => {
  if (!hasScanStartedRef.current) return;

  const normalize = (val) => String(val ?? '').trim().replace(/[^\x20-\x7E]/g, '');
  const scanned = normalize(data.barcode);
  const expected = normalize(currentMaterialRef.current?.barcode);

  

  if (!expected) {
    alert("⚠️ No barcode configured for current material.");
    return;
  }

  if (scanned === expected) {
    firstScanRef.current = false;
 
  setBarcodeMatched(true);
  setScanLocked(true);
  setScannedDisplay('');

  // // ✅ Step 1: Show "Barcode Scanned" popup
  // await Swal.fire({
  //   title: '📦 Barcode Scanned',
  //   html: `<div style="font-size: 15px;">
  //            Barcode <strong>"${scanned}"</strong> has been scanned.
  //          </div>`,
  //   icon: 'info',
  //   timer: 3000,
  //   showConfirmButton: false,
  //   allowOutsideClick: false,
  //   timerProgressBar: true
  // });

  // ✅ Step 2: Show "Barcode Verified" popup
  await Swal.fire({
  title: 'Barcode Verified',
  html: `<div style="font-size: 16px; margin-top: 6px;">
           Material: <strong>${currentMaterialRef.current?.title}</strong>
         </div>`,
  icon: 'success',
  timer: 5000,
  showConfirmButton: false,
  timerProgressBar: true,
  allowOutsideClick: false
});

  // ✅ Step 3: Show "Dosing Started" popup
  await Swal.fire({
    title: 'Dosing Started',
    html: `<div style="font-size: 15px;">
             Dosing process has now started for <strong>"${currentMaterialRef.current?.title}"</strong>.
             Please monitor the scale until the setpoint is reached.
           </div>`,
    icon: 'info',
    timer: 2500,
    showConfirmButton: false,
    timerProgressBar: true,
    allowOutsideClick: false
  });

  // Proceed with stopping scanner and polling
  try {
    await axios.post("http://127.0.0.1:5000/api/stop-scanner");

    // const waitToast = setInterval(() => {
    //   Swal.fire({
    //     title: '⏳ Waiting for Weight',
    //     text: 'Please continue dosing until target is reached...',
    //     toast: true,
    //     position: 'top-end',
    //     icon: 'info',
    //     showConfirmButton: false,
    //     timer: 1500,
    //     timerProgressBar: true
    //   });
    // }, 2000);
// ✅ Step 4: Poll until successful dosing
  let overweightInterval = null;

const pollUntilDosed = setInterval(async () => {
  try {
    const response = await axios.post('http://127.0.0.1:5000/api/recipe_materials/weigh-and-update');
    const result = response.data;
      if (result.success) {
        const updated = result.data;
        const setPoint = updated.set_point;
        const actual = updated.actual;
        const isFinalMaterial = result.reset_done === true; // ✅ Add this check

        // ✅ Clear all intervals
        clearInterval(pollUntilDosed);
        if (overweightInterval) {
          clearInterval(overweightInterval);
          overweightInterval = null;
        }

        // ✅ Update UI
        setOrder(prev => {
          const updatedMaterials = [...prev.materials];
          updatedMaterials[currentIndex] = {
            ...updatedMaterials[currentIndex],
            actual,
            margin: updated.margin,
            dosed: true,
            status: 'Dosed'
          };
          return { ...prev, materials: updatedMaterials };
        });

        setActualValue(actual);
        setScaleStatus('success');

        // ✅ Show final dosing popup if this was the last material

        if (isFinalMaterial) {
          await Swal.fire({
            title: '🎉 All Materials Dosed!',
            html: `
              <div style="text-align: left; font-size: 15px;">
                <p><strong>Material:</strong> ${updated.material_name}</p>
                <p><strong>Set Point:</strong> ${setPoint} kg</p>
                <p><strong>Actual:</strong> ${actual} kg</p>
                <p><strong>Margin:</strong> ${updated.margin ?? 0} gram</p>
                <p><strong>Status:</strong> Dosed ✅</p>
              </div>
            `,
            icon: 'success',
            confirmButtonText: 'Finished',
            preConfirm: async () => {
              try {
                await axios.post("http://127.0.0.1:5000/api/stop-scanner");
              } catch (err) {
                console.error("❌ Failed to stop scanner", err);
              } finally {
                setScanning(false);
                setScannedDisplay('');
                hasScanStartedRef.current = false;
                firstScanRef.current = true;
              }
            },
            confirmButtonColor: '#2563eb',
            allowOutsideClick: false
          });
        } else {
          await Swal.fire({
            title: '✅ Dosing Completed',
            html: `
              <div style="text-align: left; font-size: 15px;">
                <p><strong>Material:</strong> ${updated.material_name}</p>
                <p><strong>Set Point:</strong> ${setPoint} kg</p>
                <p><strong>Actual:</strong> ${actual} kg</p>
                <p><strong>Margin:</strong> ${updated.margin} gram</p>
                <p><strong>Status:</strong> Dosed ✅</p>
              </div>
            `,
            icon: 'success',
            confirmButtonText: 'Next',
            confirmButtonColor: '#16a34a',
            allowOutsideClick: false
          });
        }

        setShowScalePopup(false);
        advanceToNext();




    } else if (result.reason === "overweight") {
      const setPoint = result.data.set_point || currentMaterialRef.current?.setPoint;
      const actual = result.data.actual;

      // ✅ Show repeated overweight alerts
      if (!overweightInterval) {
        overweightInterval = setInterval(() => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: '⚠️ Overweight Detected!',
            text: `Actual: ${actual} kg | Set: ${setPoint} kg`,
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
            background: '#ffe5e5',
            color: '#dc2626'
          });
        }, 3000);
      }

    } else {
      // Still underweight or not ready
      console.log("⏳ Weight not yet sufficient, polling continues...");
    }

  } catch (pollErr) {
    clearInterval(pollUntilDosed);
    if (overweightInterval) {
      clearInterval(overweightInterval);
      overweightInterval = null;
    }
    console.error("❌ Error during polling:", pollErr);
    alert("Error while checking weight: " + pollErr.message);
  }
}, 1000);



  } catch (err) {
    console.error("❌ Error during barcode process:", err);
    alert("Error during process: " + err.message);
    setScanLocked(false);
  }



  } else {
    console.warn("❌ Barcode mismatch!", { scanned, expected });
    setBarcodeMatched(false);
    setScanLocked(true);
    setShowMismatchPopup(true);

    setTimeout(() => {
      setShowMismatchPopup(false);
      setScanLocked(false);
    }, 2000);
  }
});

socket.current.on('active_recipe_materials', (data) => {
  if (!data?.materials || !Array.isArray(data.materials) || data.materials.length === 0) return;

  const m = data.materials[0]; // ✅ Take only the first pending material

  const newMaterial = {
    id: m.material_id,
    title: m.material_name,
    barcode: m.barcode,
    setPoint: parseFloat(m.set_point),
    actual: parseFloat(m.actual),
    unit: '',
    recipe: data.recipe_name,
    recipe_id: data.recipe_id,
    dosed: false,
    margin: m.margin,
    status: m.status
  };

  setOrder({
    recipe_name: data.recipe_name,
    materials: [newMaterial]
  });

  setCurrentIndex(0);
  setCurrentMaterial(newMaterial);
});



  return () => {
    if (socket.current) socket.current.disconnect();
  };
}, []);



  useEffect(() => {
    if (order.materials.length > 0 && currentIndex < order.materials.length) {
      setCurrentMaterial(order.materials[currentIndex]);
    } else {
      setCurrentMaterial(null);
    }
  }, [order.materials, currentIndex]);

  useEffect(() => {
    if (currentMaterial?.setPoint) {
      setReqWeight(Number(currentMaterial.setPoint));
    }
  }, [currentMaterial, setReqWeight]);

  useEffect(() => {
    Object.entries(barcodeRefs.current).forEach(([barcode, el]) => {
      if (el && window.JsBarcode) {
        window.JsBarcode(el, barcode, {
          format: "CODE128",
          displayValue: false,
          height: 30,
        });
      }
    });
  }, [order.materials]);

  useEffect(() => {
    if (scannedDisplay && overlayBarcodeRef.current && window.JsBarcode) {
      window.JsBarcode(overlayBarcodeRef.current, scannedDisplay, {
        format: "CODE128",
        displayValue: true,
        height: 60,
        fontSize: 16,
      });
    }
  }, [scannedDisplay]);

  useEffect(() => {
    if (showScalePopup) {
      setIndicatorWidth(0);
      const interval = setInterval(() => {
        setIndicatorWidth(prevWidth => {
          if (prevWidth < 100) {
            return prevWidth + 2;
          } else {
            clearInterval(interval);
            return 100;
          }
        });
      }, 50);

      const timer = setTimeout(() => {
        setShowScalePopup(false);
      }, 3000);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [showScalePopup]);

  const handleScan = async () => {
  if (!currentMaterial) {
    alert('No material selected for scanning.');
    return;
  }

  if (!barcodeMatched) {
    alert('Please scan and match the barcode before proceeding.');
    return;
  }

  scannedCodeRef.current = '';
  setScanning(true);

  try {
    const response = await axios.post('http://127.0.0.1:5000/api/recipe_materials/weigh-and-update');

    if (response.data.success) {
      const updated = response.data.data;

      setOrder(prev => {
        const updatedMaterials = [...prev.materials];
        updatedMaterials[currentIndex] = {
          ...updatedMaterials[currentIndex],
          actual: updated.actual,
          margin: updated.margin,
          dosed: true,
          status: 'Dosed'
        };
        return { ...prev, materials: updatedMaterials };
      });

      setActualValue(updated.actual);
      setScaleStatus('success');

      await Swal.fire({
        title: '✅ Dosing Completed',
        html: `
          <div style="text-align: left; font-size: 15px;">
            <p><strong>Material:</strong> ${currentMaterialRef.current?.title}</p>
            <p><strong>Set Point:</strong> ${updated.set_point}</p>
            <p><strong>Actual:</strong> ${updated.actual}</p>
            <p><strong>Margin:</strong> ${updated.margin}Gram</p>
            <p><strong>Status:</strong> Dosed ✅</p>
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'Next',
        confirmButtonColor: '#16a34a',
        allowOutsideClick: false
      });

      setShowScalePopup(false);
      advanceToNext();
    } else {
      console.log("⏳ Weight not yet sufficient, retry later.");
      Swal.fire({
        icon: 'info',
        title: 'Not Ready',
        text: 'Weight has not yet reached setpoint. Please try again shortly.',
        confirmButtonText: 'OK'
      });
    }
  } catch (error) {
    console.error("❌ Error during weigh-and-update:", error);
    alert("Error during weighing: " + error.message);
  } finally {
    setScanning(false);
  }
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const confirmDosing = async () => {
  if (!currentMaterial) {
    alert("No material selected for dosing.");
    return;
  }

  try {
    const response = await axios.post('http://127.0.0.1:5000/api/recipe_materials/weigh-and-update');

    if (response.data.success) {
      const updated = response.data.data;

      // ✅ Update UI state
      setOrder(prev => {
        const updatedMaterials = [...prev.materials];
        updatedMaterials[currentIndex] = {
          ...updatedMaterials[currentIndex],
          actual: updated.actual,
          margin: updated.margin,
          dosed: true,
          status: 'Dosed'
        };
        return { ...prev, materials: updatedMaterials };
      });

      // ✅ Step 1: Trigger Scale Popup
      setScaleStatus('success');
      setIndicatorWidth(0);
      setShowScalePopup(true);

      // ✅ Step 2: Let React render the popup
      await new Promise(resolve => requestAnimationFrame(resolve));
      await wait(150); // Give time for popup to visually appear

      // ✅ Step 3: Animate Scale Bar
      for (let i = 0; i <= 100; i += 2) {
        setIndicatorWidth(i);
        await wait(40); // ~2.5s total
      }

      await wait(1000); // small pause after fill

      // ✅ Step 4: Hide ScalePopup
      setShowScalePopup(false);

      // ✅ Step 5: Show Success Message
      await Swal.fire({
        title: '✅ Dosing Completed',
        html: `
          <div style="text-align: left; font-size: 15px;">
            <p><strong>Material:</strong> ${updated.material_name}</p>
            <p><strong>Set Point:</strong> ${updated.set_point} kg</p>
            <p><strong>Actual:</strong> ${updated.actual} kg</p>
            <p><strong>Status:</strong> Dosed ✅</p>
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'Next',
        confirmButtonColor: '#16a34a',
        allowOutsideClick: false
      });

      advanceToNext();

    } else {
      Swal.fire({
        icon: 'info',
        title: '⏳ Not Ready',
        text: 'Weight has not reached setpoint yet. Please wait.',
        confirmButtonText: 'OK'
      });
    }

  } catch (err) {
    console.error("❌ Error confirming dosing:", err);
    alert("Failed to confirm dosing: " + err.message);
  }
};


const bypassAllPendingForRecipe = async () => {
  const recipeId = currentMaterial?.recipe_id;

  if (!recipeId) {
    console.warn("⚠️ No recipe ID found for the current material.");
    return;
  }

  const result = await Swal.fire({
    title: '🚫 Bypass All Pending Materials?',
    html: `<div style="font-size: 15px;">
             This will bypass <strong>all pending materials</strong> 
             for recipe <strong>${order.recipe_name}</strong>.<br><br>
             Are you sure you want to continue?
           </div>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, bypass all',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#d33'
  });

  if (!result.isConfirmed) return;

  try {
    const res = await axios.post(`http://127.0.0.1:5000/api/recipe_materials/bypass/${recipeId}`);
    
    await Swal.fire({
      title: '✅ Materials Bypassed',
      text: res.data.message,
      icon: 'success',
      confirmButtonColor: '#16a34a'
    });

    setOrder({ materials: [], recipe_name: '' });
    setCurrentMaterial(null);
    setBarcodeMatched(false);
    setScanLocked(false);
    setActualValue('');

    await axios.post("http://127.0.0.1:5000/api/start-scanner");
    fetchActiveMaterial();

  } catch (err) {
    console.error("❌ Bypass failed:", err);
    // Removed the Swal error popup — silent fail
  }
};

useEffect(() => {
  if (currentMaterial) {
    
    if (!currentMaterial.recipe_id) {
      console.warn("⚠️ currentMaterial missing recipe_id!");
    }
  }
}, [currentMaterial]);

const MismatchPopup = () => {
  return (
    <div style={{
      position: 'fixed',
      top: '20%',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#ffe5e5',
      border: '2px solid red',
      padding: '20px',
      borderRadius: '10px',
      zIndex: 1000,
      width: '300px',
      textAlign: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    }}>
      <h3 style={{ color: 'red', fontWeight: 'bold', marginBottom: '10px' }}>❌ Wrong Barcode Scanned</h3>
      <p>Wrong Barcode scaned Please try again.</p>
    </div>
  );
};
const advanceToNext = async () => {
  setActualValue('');
  setScanLocked(false);
  setBarcodeMatched(false);

  try {
    const res = await axios.get('http://127.0.0.1:5000/api/recipe_materials/active');

    if (res.data?.recipe_name) {
      const m = res.data;

      const newMaterial = {
        id: m.material_id,
        title: m.material_name,
        barcode: m.barcode,
        setPoint: parseFloat(m.set_point),
        actual: parseFloat(m.actual),
        unit: '',
        recipe: m.recipe_name,
        recipe_id: m.recipe_id,
        dosed: false,
        margin: m.margin,
        status: m.status,
      };

      setOrder({
        materials: [newMaterial],
        recipe_name: newMaterial.recipe,
      });
      setCurrentMaterial(newMaterial);
      setCurrentIndex(0);

      const resetDone = res.data?.reset_done === true;

      if (!resetDone && !firstScanRef.current) {
        await axios.post('http://127.0.0.1:5000/api/start-scanner');
        setScanning(true);
        setScannedDisplay(newMaterial.barcode);
        hasScanStartedRef.current = true;
      } else {
        firstScanRef.current = true;
        hasScanStartedRef.current = false;
        setScanning(false);
        setScannedDisplay(''); // ✅ Clear barcode overlay
      }

    } else {
      setOrder({ materials: [], recipe_name: '' });
      setCurrentMaterial(null);
      setCurrentIndex(0);
      firstScanRef.current = true;
      setScannedDisplay(''); // ✅ Also clear overlay on no active data
    }
  } catch (err) {
    console.error('Failed to fetch next pending material', err);
    alert("Failed to load next material: " + err.message);
  }
};

const handleStopScanner = async () => {
  try {
    await axios.post("http://127.0.0.1:5000/api/stop-scanner");
  } catch (err) {
    console.error("❌ Failed to stop scanner", err);
  } finally {
    setScanning(false);
    setScannedDisplay('');
    hasScanStartedRef.current = false;
    firstScanRef.current = true;
  }
};


  const ScalePopup = ({ scaleStatus,indicatorWidth, onClose }) => {
    const backgroundColor = scaleStatus === "outOfRange" ? "#ffe5e5" : "#e5ffe5";
    const indicatorColor = scaleStatus === "outOfRange" ? "red" : "green";
    const message = scaleStatus === "outOfRange"
      ? " Dosing out of margin!"
      : " Dosing completed successfully!";

    const overlayStyles = {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      zIndex: 999,
    };

    const scalePopupStyles = {
      position: 'fixed',
      top: '20%',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: backgroundColor,
      border: `2px solid ${indicatorColor}`,
      padding: '20px',
      width: '300px',
      textAlign: 'center',
      borderRadius: '10px',
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
      zIndex: 1000,
    };

    const scaleBarStyles = {
      width: '100%',
      height: '20px',
      backgroundColor: '#e0e0e0',
      borderRadius: '10px',
      position: 'relative',
      marginBottom: '20px',
    };

    const scaleIndicatorStyles = {
      position: 'absolute',
      top: '0',
      height: '100%',
      width: `${indicatorWidth}%`,
      borderRadius: '10px',
      left: '0',
      backgroundColor: indicatorColor,
      transition: 'width 0.05s',
    };

    const scaleMessageStyles = {
      fontSize: '18px',
      marginBottom: '20px',
      fontWeight: 'bold',
      color: indicatorColor
    };

    return (
      <div style={overlayStyles}>
        <div style={scalePopupStyles}>
          <div style={scaleBarStyles}>
            <div style={scaleIndicatorStyles}></div>
          </div>
          <div style={scaleMessageStyles}>{message}</div>
        </div>
      </div>
    );
  };

  const user = JSON.parse(localStorage.getItem("user"));
  const userRole = user?.role;
  console.log("user role :", userRole)

  return (
    <div className="p-6 text-black bg-white min-h-screen">
      <Orders />
      <h2 className="text-3xl font-bold mb-6">Active Order: {order.recipe_name}</h2>

      <div className="mb-4 flex gap-4 items-center">
<button
  onClick={async () => {
    if (!currentMaterial?.barcode) {
      alert("⚠️ No barcode set.");
      return;
    }

    try {
      await axios.post("http://127.0.0.1:5000/api/start-scanner");
    } catch (err) {
      console.error("❌ Failed to start scanner listener", err);
      alert("❌ Could not start scanner listener.");
      return;
    }

    Swal.fire({
      title: '🎯 Scanner Ready',
      text: `Ready to scan barcode for "${currentMaterial.title}"`,
      icon: 'info',
      confirmButtonText: 'OK',
      confirmButtonColor: '#3085d6',
    });

    hasScanStartedRef.current = true;
    setScanning(true);
    setScannedDisplay(currentMaterial.barcode);
    firstScanRef.current = false;  // ✅ Mark first scan as complete
  }}
  disabled={!firstScanRef.current || hasScanStartedRef.current} // ✅ Disable if not first OR already started
  className={`px-6 py-2 rounded shadow-md flex items-center gap-2 ${
    !firstScanRef.current || hasScanStartedRef.current
      ? 'bg-gray-400 cursor-not-allowed'
      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
  }`}
>
  <i className="fa-solid fa-qrcode"></i> Start Barcode Scan
</button>





        <span className="text-lg font-medium">
  {barcodeMatched
    ? scanLocked
      ? '✅ Barcode matched — Waiting for weight...'
      : 'Scanned Successfully'
    : 'Waiting for scan...'}
</span>

        {currentMaterial && (
          <div className="w-full flex justify-end pr-4">
            <ScaleBar
              actual={currentMaterial.actual}
              setPoint={currentMaterial.setPoint}
              margin={currentMaterial.margin || 0.05}
            />
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left border bg-gray-200">
          <thead className="bg-gray-300 text-sm">
            <tr>
              <th className="p-3 border">Formula</th>
              <th className="p-3 border">Material</th>
              <th className="p-3 border">Barcode</th>
              <th className="p-3 border">Set Point</th>
              <th className="p-3 border">Actual</th>
              <th className="p-3 border">Err%</th>
              {/* <th className="p-3 border">Dosing</th> */}
              <th className="p-3 border">Status</th>
              <th className="p-3 border">Actions</th>
            </tr>
          </thead>
          <tbody>
  {order.materials.length === 0 ? (
    <tr>
      <td colSpan={8} className="text-center py-6 text-gray-500 font-medium border border-t-0">
        No materials available for this order.
      </td>
    </tr>
  ) : (
    order.materials.map((mat, idx) => (
      <tr
        key={mat.id}
        className={
          idx === currentIndex
            ? 'bg-blue-50'
            : mat.dosed
              ? 'bg-green-100'
              : 'bg-white'
        }
      >
        <td className="p-3 border">{mat.recipe || mat.recipeName}</td>
        <td className="p-3 border font-semibold">{mat.title}</td>
        <td className="p-3 border text-sm">
          <div className="flex flex-col items-start gap-1">
            <span className="text-xs text-gray-400">{mat.barcode}</span>
            {mat.barcode ? (
              <svg
                ref={(el) => (barcodeRefs.current[mat.barcode] = el)}
                style={{
                  width: '100%',
                  maxWidth: '150px',
                  height: '40px',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <span className="text-xs text-gray-400">No Barcode</span>
            )}
          </div>
        </td>
        <td className="p-3 border">{mat.setPoint}</td>
        <td className="p-3 border">
          {idx === currentIndex && mat.dosed
            ? actualValue !== undefined && actualValue !== null
              ? mat.actual
              : '—'
            : mat.actual !== undefined && mat.actual !== null
              ? mat.actual
              : '—'}
        </td>
        <td className="p-3 border">
          {mat.setPoint !== undefined && mat.setPoint !== null &&
          mat.actual !== undefined && mat.actual !== null
            ? `${Math.abs(((Number(mat.actual) - Number(mat.setPoint)) / Number(mat.setPoint)) * 100).toFixed(2)}%`
            : '—'}
        </td>
        {/* <td className="p-3 border">
          {/* Calculate and display Dosing value: Total Set Points / Number of Materials */}
          {/* {order.materials.length > 0
            ? (order.materials.reduce((sum, material) => sum + parseFloat(material.setPoint || 0), 0) / order.materials.length).toFixed(2)
            : '—'}
        </td> */} 
        <td className="p-3 border">
          {mat.dosed
            ? mat.bypassed
              ? 'Bypassed'
              : 'Dosed ✅'
            : idx === currentIndex
              ? 'In Progress'
              : 'Pending'}
        </td>

        <td className="p-3 border">
          {userRole === "admin" && idx === currentIndex && !mat.dosed && (
            <div className="flex gap-2">
              <button
                onClick={confirmDosing}
                className="bg-green-600 text-white px-4 py-2 rounded shadow-md hover:bg-green-700 transition"
              >
                ✅ Confirm
              </button>
            </div>
          )}
        </td>

      </tr>
    ))
  )}
</tbody>

        </table>
{order.materials.length > 0 && currentMaterial && !currentMaterial.dosed && userRole === "admin" && (
  <div className="mt-6 flex justify-end pr-4">
    <button
      onClick={bypassAllPendingForRecipe}
      className="bg-red-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-red-700 transition text-base font-semibold"
    >
      🚫 Bypass All
    </button>
  </div>
)}
      </div>

     {showScalePopup && (
  <ScalePopup
    scaleStatus={scaleStatus}
    indicatorWidth={indicatorWidth}  // ✅ pass as prop
    onClose={() => setShowScalePopup(false)}
  />
)}
      {showMismatchPopup && (
        <MismatchPopup
          scanned={scannedDisplay}
          expected={currentMaterial?.barcode}
          onClose={() => {
            setShowMismatchPopup(false);
            setScanLocked(false);
            setScannedDisplay('');
          }}
        />
      )}
{scannedDisplay && (
  <div style={{
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#111827',
    color: '#f9fafb',
    padding: '16px 20px',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    fontSize: '16px',
    zIndex: 1000,
    width: '300px',
    fontFamily: 'Arial, sans-serif'
  }}>
    <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>
      🔍 Verifying Barcode
    </div>
    <div style={{ fontSize: '14px', marginBottom: '8px' }}>
      <strong>Code:</strong> {scannedDisplay}
    </div>
    <div style={{ backgroundColor: '#fff', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
      <svg ref={overlayBarcodeRef}></svg>
    </div>

    {/* ✅ Add Stop Scanner Button */}
    <button
      onClick={handleStopScanner}
      style={{
        marginTop: '12px',
        backgroundColor: '#dc2626',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        padding: '8px 16px',
        fontWeight: 'bold',
        cursor: 'pointer'
      }}
    >
      🛑 Stop Scanner
    </button>
  </div>
)}

    </div>
  );
};

export default ActiveOrders;