// import React from 'react';

// const ScaleBar = ({ actual, setPoint, margin = 0.05 }) => {
//   const actualNum = parseFloat(actual);
//   const setPointNum = parseFloat(setPoint);
//   if (isNaN(actualNum) || isNaN(setPointNum) || setPointNum === 0) return null;

//   const percentActual = Math.min(100, (actualNum / setPointNum) * 100);
//   const toleranceEnd = Math.min(100, percentActual + margin * 100);
//   const inRange = Math.abs(actualNum - setPointNum) <= setPointNum * margin;

//   return (
//     <div
//       style={{
//         background: 'radial-gradient(circle at top left, #f0f4ff, #ffffff)',
//         borderRadius: '20px',
//         padding: '20px 24px',
//         width: '750px',
//         color: '#1f1f1f',
//         fontFamily: 'Segoe UI, sans-serif',
//         boxShadow: '0 10px 20px rgba(0, 0, 0, 0.04)',
//         border: '1px solid #e0e6ef',
//       }}
//     >
//       {/* Centered Actual Value */}
//       <div
//         style={{
//           textAlign: 'center',
//           fontSize: '80px',
//           fontWeight: 900,
//           color: inRange ? '#2e7d32' : '#d32f2f',
//           marginBottom: '10px',
//           lineHeight: '1.1',
//         }}
//       >
//         {actualNum.toFixed(2)}
//       </div>

//       {/* Labels: 0 and Set Point */}
//       <div
//         style={{
//           display: 'flex',
//           justifyContent: 'space-between',
//           fontSize: '40px',
//           fontWeight: 800,
//           color: '#333',
//           marginBottom: '6px',
//         }}
//       >
//         <span>0</span>
//         <span>{setPointNum.toFixed(0)}</span>
//       </div>

//       {/* Progress Bar */}
//       <div
//         style={{
//           position: 'relative',
//           background: '#eaeaea',
//           height: '44px',
//           borderRadius: '22px',
//           overflow: 'hidden',
//           boxShadow:
//             'inset 1px 1px 4px rgba(0,0,0,0.05), inset -1px -1px 4px rgba(255,255,255,0.4)',
//         }}
//       >
//         {/* Red Fill */}
//         <div
//           style={{
//             width: `${percentActual}%`,
//             height: '100%',
//             background: 'linear-gradient(to right, #ff4e50, #c31432)',
//             borderTopLeftRadius: '22px',
//             borderBottomLeftRadius: '22px',
//             transition: 'width 0.4s ease-in-out',
//             position: 'absolute',
//             left: 0,
//             zIndex: 2,
//           }}
//         />

//         {/* Tolerance Band */}
//         <div
//           style={{
//             width: `${Math.max(0, toleranceEnd - percentActual)}%`,
//             height: '100%',
//             background: 'rgba(76, 175, 80, 0.25)',
//             position: 'absolute',
//             left: `${percentActual}%`,
//             zIndex: 1,
//           }}
//         />

//         {/* Transparent Remainder */}
//         <div
//           style={{
//             width: `${100 - toleranceEnd}%`,
//             height: '100%',
//             background: 'transparent',
//             position: 'absolute',
//             left: `${toleranceEnd}%`,
//             zIndex: 0,
//           }}
//         />
//       </div>
//     </div>
//   );
// };

// export default ScaleBar;

import React, { useEffect, useState } from 'react';

const ScaleBar = ({ setPoint, margin = 0.05 }) => {
  const [actual, setActual] = useState(0);
  const setPointNum = parseFloat(setPoint);

  useEffect(() => {
    const eventSource = new EventSource('http://127.0.0.1:5000/api/scale/live-weight');
    eventSource.onmessage = (event) => {
      const data = parseFloat(event.data.replace(/[^\d.-]/g, ''));
      if (!isNaN(data)) {
        setActual(data);
      }
    };
    eventSource.onerror = () => {
      console.error('Failed to connect to scale');
      eventSource.close();
    };
    return () => eventSource.close();
  }, []);

  if (isNaN(setPointNum) || setPointNum === 0) return null;
  const percentActual = Math.min(100, (actual / setPointNum) * 100);

  // Color logic
  let barColor = '#C31432'; // Red
  if (percentActual >= 80) {
    barColor = '#22C55E'; // Green
  } else if (percentActual >= 50) {
    barColor = '#FACC15'; // Yellow
  }

  return (
    <div className="border-4 border-[#E0E6EF] rounded-[20px] shadow-md"
         style={{
           background: 'radial-gradient(circle at top left, #F0F4FF, #FFFFFF)',
           padding: '20px 24px',
           width: '750px',
           color: '#1F1F1F',
           fontFamily: 'Segoe UI, sans-serif',
           boxShadow: '0 10px 20px rgba(0, 0, 0, 0.04)',
         }}
    >
      <div style={{
        textAlign: 'center',
        fontSize: '80px',
        fontWeight: 900,
        color: barColor,
        marginBottom: '10px',
      }}>
        {actual.toFixed(2)}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '80px',
        fontWeight: 800,
        color: '#333',
        marginBottom: '6px',
      }}>
        <span>0</span>
        <span>{setPointNum.toFixed(0)}</span>
      </div>

      <div style={{
        position: 'relative',
        background: '#EAEAEA',
        height: '44px',
        borderRadius: '22px',
        overflow: 'hidden',
        boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.05), inset -1px -1px 4px rgba(255,255,255,0.4)',
      }}>
        <div style={{
          width: `${percentActual}%`,
          height: '100%',
          background: barColor,
          borderTopLeftRadius: '22px',
          borderBottomLeftRadius: '22px',
          transition: 'width 0.4s ease-in-out',
        }} />
      </div>
    </div>
  );
};

export default ScaleBar;
