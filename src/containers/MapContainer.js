/* eslint-disable no-nested-ternary */
/* global kakao */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useHistory } from "react-router-dom";
import { toJS } from "mobx";
import { observer } from "mobx-react";
import { isEmpty, debounce } from "lodash";
import useStore from "../hooks/useStore";
import Map from "../components/Map/Map";
import { ReactComponent as LocationIcon } from "../images/icon-locate.svg";
import { ReactComponent as LocationActiveIcon } from "../images/icon-locate-active.svg";
import CurrentLocationIcon from "../images/current-location.svg";
import FloatingActionButton from "../components/FloatingActionButton/FloatingActionButton";
import BlinkingLocationIcon from "../components/BlinkingLocationIcon/BlinkingLocationIcon";
import Card from "../components/Card/Card";
import useGeoLocation from "../hooks/useGeoLocation";
import MapPickerSprite from "../images/icon-mappicker-sprite.png";

const selectedMarkerImage = new kakao.maps.MarkerImage(MapPickerSprite, new kakao.maps.Size(48, 48), {
  spriteOrigin: new kakao.maps.Point(24, 0),
  spriteSize: new kakao.maps.Size(72, 48),
  offset: new kakao.maps.Point(23, 46),
});
const unselectedMarkerImage = new kakao.maps.MarkerImage(MapPickerSprite, new kakao.maps.Size(24, 24), {
  spriteOrigin: new kakao.maps.Point(0, 0),
  spriteSize: new kakao.maps.Size(72, 48),
});
const currentLocationMarkerImage = new kakao.maps.MarkerImage(CurrentLocationIcon, new kakao.maps.Size(36, 36), {
  offset: new kakao.maps.Point(18, 18),
});

const MapContainer = () => {
  const history = useHistory();
  const mapRef = useRef(null);
  const { currentCoordinates, fetch, isFetching } = useGeoLocation();

  const { CardStore } = useStore();

  const [mapInstance, setMapInstance] = useState(null);
  const [cafeData, setCafeData] = useState([]);
  const [nowSelectingCafe, setNowSelectingCafe] = useState(null);
  const [currentLocationMarker, setCurrentLocationMarker] = useState(null);
  const [isOutOfCenter, setIsOutOfCenter] = useState(true);

  const getKakaoMapObject = useCallback(() => {
    const container = mapRef.current;
    const options = {
      center: new kakao.maps.LatLng(37.498095, 127.02761),
      level: 3,
    };

    const kakaoMap = new window.kakao.maps.Map(container, options);
    return kakaoMap;
  }, []);

  const handleClickMarker = useCallback(data => {
    setNowSelectingCafe(prevState => {
      if (prevState && prevState.marker) {
        prevState.marker.setImage(unselectedMarkerImage);
      }
      return data;
    });

    data.marker.setImage(selectedMarkerImage);
  }, []);

  const deleteAllMarkers = useCallback(() => {
    setCafeData(prevState => {
      prevState.forEach(data => {
        data.marker.setMap(null);
        data.marker.setImage(unselectedMarkerImage);
      });
      return [];
    });
  }, []);

  const showAllMarkers = useCallback(() => {
    if (!mapInstance || cafeData.length <= 0) {
      return;
    }

    cafeData.forEach(data => {
      const { marker } = data;
      kakao.maps.event.addListener(marker, "click", () => handleClickMarker(data));
      kakao.maps.event.addListener(mapInstance, "click", () => {
        marker.setImage(unselectedMarkerImage);
        setNowSelectingCafe(null);
        mapInstance && mapInstance.relayout();
      });
      marker.setMap(mapInstance);
    });
  }, [handleClickMarker, cafeData, mapInstance]);

  const moveToCurrentCoordinates = useCallback(() => {
    if (!mapInstance || !currentCoordinates) {
      return;
    }

    const lat = currentCoordinates.latitude;
    const lng = currentCoordinates.longitude;
    const nowLatLng = new kakao.maps.LatLng(lat, lng);
    mapInstance.setCenter(nowLatLng);
    setCurrentLocationMarker(prevState => {
      if (prevState) {
        prevState.setMap(null);
      }
      return new kakao.maps.Marker({
        title: "현위치",
        position: nowLatLng,
        map: mapInstance,
        image: currentLocationMarkerImage,
        clickable: false,
      });
    });
  }, [currentCoordinates, mapInstance]);

  const getCurrentCoordinates = useCallback(() => {
    deleteAllMarkers();
    setNowSelectingCafe(null);
    fetch();
  }, [deleteAllMarkers, fetch]);

  const loadCafeData = useCallback(async () => {
    await CardStore.fetchCard();
  }, [CardStore]);

  const checkKakaoMapDragEnd = useCallback(() => {
    if (mapInstance && currentCoordinates) {
      kakao.maps.event.addListener(mapInstance, "dragend", () => {
        const latlng = mapInstance.getCenter();
        const centerLatitude = latlng.getLat();
        const centerLongitude = latlng.getLng();

        const currentLatitude = currentCoordinates.latitude;
        const currentLongitude = currentCoordinates.longitude;

        const latitudeDifference = Math.abs(currentLatitude - centerLatitude);
        const longitudeDifference = Math.abs(currentLongitude - centerLongitude);

        // 현위치와 지도의 중심이 0.0025만큼 차이가 있을 때
        // 현위치에서 지도의 중심이 멀어져서 현위치가 아니라고 한다.
        if (latitudeDifference > 0.0025 || longitudeDifference > 0.0025) {
          setIsOutOfCenter(false);
        } else {
          setIsOutOfCenter(true);
        }
      });
    }
  }, [mapInstance, currentCoordinates]);

  const handleCardLinkClick = useCallback(
    card => {
      history.push(`/detail/${card.id}`);
    },
    [history],
  );

  const handleLocationButtonClick = useCallback(() => {
    CardStore.init();
    getCurrentCoordinates();
    loadCafeData();
  }, [CardStore, getCurrentCoordinates, loadCafeData]);

  const setViewportHeight = useCallback(() => {
    document.body.style.height = `${window.innerHeight}px`;
    mapInstance && mapInstance.relayout();
  }, [mapInstance]);

  useEffect(() => {
    const kakaoMap = getKakaoMapObject();
    setMapInstance(kakaoMap);
  }, [getKakaoMapObject]);

  useEffect(() => {
    checkKakaoMapDragEnd();
  }, [checkKakaoMapDragEnd]);

  useEffect(() => {
    const debounced = debounce(setViewportHeight, 200);
    window.addEventListener("resize", debounced);

    return function cleanup() {
      debounced.cancel();
      window.removeEventListener("resize", debounced);
    };
  }, [mapInstance, setViewportHeight]);

  useEffect(() => {
    moveToCurrentCoordinates();
    setIsOutOfCenter(true);
  }, [moveToCurrentCoordinates, setIsOutOfCenter]);

  useEffect(() => {
    if (isEmpty(CardStore.cardDatas)) {
      loadCafeData();
      return;
    }
    setCafeData(toJS(CardStore.cardDatas));
    setNowSelectingCafe(null);
  }, [CardStore.cardDatas, loadCafeData]);

  useEffect(() => {
    showAllMarkers();

    return () => {
      cafeData.forEach(data => {
        const { marker } = data;
        marker.setImage(unselectedMarkerImage);
      });
      setNowSelectingCafe(null);
    };
  }, [showAllMarkers, cafeData]);

  useEffect(() => {
    setViewportHeight();
  }, [setViewportHeight]);

  return (
    <>
      <Map mapRef={mapRef} isSelected={!!nowSelectingCafe}>
        <FloatingActionButton onClick={handleLocationButtonClick}>
          {!currentCoordinates || isFetching || !isOutOfCenter ? <LocationIcon /> : CardStore.isLoading.fetchCard ? <BlinkingLocationIcon /> : <LocationActiveIcon />}
        </FloatingActionButton>
      </Map>
      {nowSelectingCafe && <Card showOnlyInfo={true} onCardLinkClick={() => handleCardLinkClick(nowSelectingCafe)} cardData={nowSelectingCafe} />}
    </>
  );
};

export default observer(MapContainer);
